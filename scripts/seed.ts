import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import pg from "pg";
import type { Database } from "../src/types/database.ts";
import { IDENTITIES, MEDICATIONS, PATIENTS, SEED_DRAFTS, SEED_SIGNED } from "./fixtures.ts";
import { assertSeedablePassword, loadTestEnv, TestEnvError, type TestEnv } from "./test-env.ts";

let env;
try {
  env = loadTestEnv(process.argv.includes("--env") ? process.argv[process.argv.indexOf("--env") + 1] : ".env.test");
  assertSeedablePassword(env.testUserPassword);
} catch (error) {
  if (error instanceof TestEnvError) {
    console.error(`Refusing to run: ${error.message}`);
    process.exit(1);
  }
  throw error;
}

const admin = createClient(env.supabaseUrl, env.secretKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

for (const identity of Object.values(IDENTITIES)) {
  const existing = await admin.auth.admin.getUserById(identity.id);
  if (existing.data.user) {
    const { error } = await admin.auth.admin.updateUserById(identity.id, {
      password: env.testUserPassword,
      email_confirm: true,
    });
    if (error) throw new Error(`Could not update ${identity.email}: ${error.message}`);
    console.log(`Updated auth user ${identity.email}`);
  } else {
    const { error } = await admin.auth.admin.createUser({
      id: identity.id,
      email: identity.email,
      password: env.testUserPassword,
      email_confirm: true,
      user_metadata: { full_name: identity.fullName },
    });
    if (error) throw new Error(`Could not create ${identity.email}: ${error.message}`);
    console.log(`Created auth user ${identity.email}`);
  }
}

const client = new pg.Client({ connectionString: env.dbUrl });
await client.connect();
try {
  await client.query("begin");
  await client.query(readFileSync(resolve("supabase/seed/synthetic.sql"), "utf8"));
  await client.query("commit");
  console.log("Synthetic seed data applied.");
} catch (error) {
  await client.query("rollback");
  throw error;
} finally {
  await client.end();
}

await seedSignedPrescriptions(env);
await seedRowanBlockingDraft(env);

/**
 * Signed DEMO prescriptions for Rowan Testcase and Elliot Samplewood, so the chart has something
 * to renew. Made the way the app makes them: signed in as clinicianA (RLS applies), insert the
 * draft, run `evaluate_prescription_safety`, then `sign_prescription`, which also adds the active
 * medication. Skipped when the prescription with the fixed idempotency key is already signed.
 */
async function seedSignedPrescriptions(env: TestEnv): Promise<void> {
  const plans = [
    { key: SEED_SIGNED.northOnePloxidrin, patientId: PATIENTS.northOne, medicationId: MEDICATIONS.ploxidrin, dose: 100, label: "Rowan Testcase" },
    { key: SEED_SIGNED.northTwoZentoril, patientId: PATIENTS.northTwo, medicationId: MEDICATIONS.zentoril, dose: 10, label: "Elliot Samplewood" },
  ];
  await asClinicianA(env, async (clinician) => {
    for (const plan of plans) {
      const existing = await clinician
        .from("prescriptions")
        .select("id, status")
        .eq("prescriber_id", IDENTITIES.clinicianA.id)
        .eq("idempotency_key", plan.key)
        .maybeSingle();
      if (existing.error) throw new Error(`Could not read ${plan.label}'s seeded prescription: ${existing.error.message}`);
      if (existing.data && existing.data.status !== "draft") {
        console.log(`The seeded prescription for ${plan.label} is ${existing.data.status}; none added.`);
        continue;
      }
      let id = existing.data?.id;
      if (!id) {
        const inserted = await clinician
          .from("prescriptions")
          .insert({
            patient_id: plan.patientId,
            prescriber_id: IDENTITIES.clinicianA.id,
            medication_id: plan.medicationId,
            dose_amount: plan.dose,
            dose_unit: "mg",
            route: "oral",
            frequency: "once_daily",
            quantity: 30,
            refills: 1,
            start_date: new Date().toISOString().slice(0, 10),
            instructions: "Synthetic seed prescription (DEMO).",
            idempotency_key: plan.key,
          })
          .select("id")
          .single();
        if (inserted.error) throw new Error(`Could not create ${plan.label}'s prescription: ${inserted.error.message}`);
        id = inserted.data.id;
      }
      const checked = await clinician.rpc("evaluate_prescription_safety", { p_prescription_id: id });
      if (checked.error) throw new Error(`Could not run the safety check: ${checked.error.message}`);
      const version = (checked.data as { version: number }).version;
      const signed = await clinician.rpc("sign_prescription", { p_prescription_id: id, p_expected_version: version });
      if (signed.error) throw new Error(`Could not sign ${plan.label}'s prescription: ${signed.error.message}`);
      console.log(`Signed DEMO prescription for ${plan.label}.`);
    }
  });
}

async function asClinicianA(
  env: TestEnv,
  fn: (clinician: ReturnType<typeof createClient<Database>>) => Promise<void>,
): Promise<void> {
  const clinician = createClient<Database>(env.supabaseUrl, env.publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const signedIn = await clinician.auth.signInWithPassword({
    email: IDENTITIES.clinicianA.email,
    password: env.testUserPassword,
  });
  if (signedIn.error) throw new Error(`Could not sign in as ${IDENTITIES.clinicianA.email}: ${signedIn.error.message}`);
  try {
    await fn(clinician);
  } finally {
    await clinician.auth.signOut();
  }
}

/**
 * One blocking DEMO draft for Rowan Testcase, so the chart's alert banner shows on kestrel-test.
 * Made the way the app makes it: signed in as clinicianA with the publishable key (RLS applies),
 * insert the draft, then run `evaluate_prescription_safety`, which writes the real blocking alert.
 * Skipped when Rowan already has a draft with an unresolved blocking alert on its checked version.
 * The e2e and integration resets delete this draft (they keep only SEED_SIGNED); run the seed again afterwards.
 */
async function seedRowanBlockingDraft(env: TestEnv): Promise<void> {
  await asClinicianA(env, async (clinician) => {
    const existing = await clinician
      .from("prescriptions")
      .select("id, status, version, last_evaluated_version, idempotency_key, prescription_alerts(prescription_version, severity, resolved_at)")
      .eq("patient_id", PATIENTS.northOne)
      .eq("prescriber_id", IDENTITIES.clinicianA.id);
    if (existing.error) throw new Error(`Could not read Rowan Testcase's prescriptions: ${existing.error.message}`);

    const blocked = existing.data.find(
      (rx) =>
        rx.status === "draft" &&
        rx.last_evaluated_version === rx.version &&
        rx.prescription_alerts.some((a) => a.prescription_version === rx.version && a.severity === "blocking" && !a.resolved_at),
    );
    if (blocked) {
      console.log("Rowan Testcase already has a blocking DEMO draft; none added.");
      return;
    }

    const seeded = existing.data.find((rx) => rx.idempotency_key === SEED_DRAFTS.northOneZentorilBlocking);
    if (seeded && seeded.status !== "draft") {
      console.log(`The seeded draft for Rowan Testcase is ${seeded.status}; none added.`);
      return;
    }
    let id = seeded?.id;
    if (!id) {
      const inserted = await clinician
        .from("prescriptions")
        .insert({
          patient_id: PATIENTS.northOne,
          prescriber_id: IDENTITIES.clinicianA.id,
          medication_id: MEDICATIONS.zentoril,
          dose_amount: 10,
          dose_unit: "mg",
          route: "oral",
          frequency: "once_daily",
          quantity: 30,
          start_date: new Date().toISOString().slice(0, 10),
          instructions: "Synthetic seed draft (DEMO).",
          idempotency_key: SEED_DRAFTS.northOneZentorilBlocking,
        })
        .select("id")
        .single();
      if (inserted.error) throw new Error(`Could not create Rowan Testcase's draft: ${inserted.error.message}`);
      id = inserted.data.id;
    }

    const checked = await clinician.rpc("evaluate_prescription_safety", { p_prescription_id: id });
    if (checked.error) throw new Error(`Could not run the safety check: ${checked.error.message}`);
    console.log("Blocking DEMO draft for Rowan Testcase created and safety-checked.");
  });
}
