import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import pg from "pg";
import { IDENTITIES, MEDICATIONS, PATIENTS, SEED_DRAFTS } from "./fixtures.ts";
import { asClinicianA, seedSignedPrescriptions, type SeedConnection } from "./seed-prescriptions.ts";
import { assertSeedablePassword, loadTestEnv, TestEnvError } from "./test-env.ts";

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

const connection: SeedConnection = {
  supabaseUrl: env.supabaseUrl,
  publishableKey: env.publishableKey,
  password: env.testUserPassword,
};
await seedSignedPrescriptions(connection);
await seedRowanBlockingDraft(connection);

/**
 * One blocking DEMO draft for Rowan Testcase, so the chart's alert banner shows on kestrel-test.
 * Made the way the app makes it: signed in as clinicianA with the publishable key (RLS applies),
 * insert the draft, then run `evaluate_prescription_safety`, which writes the real blocking alert.
 * Skipped when Rowan already has a draft with an unresolved blocking alert on its checked version.
 * The e2e and integration resets delete this draft (they keep only SEED_SIGNED); run the seed again afterwards.
 */
async function seedRowanBlockingDraft(connection: SeedConnection): Promise<void> {
  await asClinicianA(connection, async (clinician) => {
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
