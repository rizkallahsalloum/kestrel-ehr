import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/types/database.ts";
import { IDENTITIES, MEDICATIONS, PATIENTS, SEED_SIGNED } from "./fixtures.ts";

export type SeedConnection = {
  supabaseUrl: string;
  publishableKey: string;
  /** clinicianA's password on the target project. */
  password: string;
};

export type ClinicianClient = ReturnType<typeof createClient<Database>>;

export const SIGNED_PLANS = [
  { key: SEED_SIGNED.northOnePloxidrin, patientId: PATIENTS.northOne, medicationId: MEDICATIONS.ploxidrin, dose: 100, label: "Rowan Testcase" },
  { key: SEED_SIGNED.northTwoZentoril, patientId: PATIENTS.northTwo, medicationId: MEDICATIONS.zentoril, dose: 10, label: "Elliot Samplewood" },
] as const;

export async function asClinicianA(conn: SeedConnection, fn: (clinician: ClinicianClient) => Promise<void>): Promise<void> {
  const clinician = createClient<Database>(conn.supabaseUrl, conn.publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const signedIn = await clinician.auth.signInWithPassword({
    email: IDENTITIES.clinicianA.email,
    password: conn.password,
  });
  if (signedIn.error) throw new Error(`Could not sign in as ${IDENTITIES.clinicianA.email}: ${signedIn.error.message}`);
  try {
    await fn(clinician);
  } finally {
    await clinician.auth.signOut();
  }
}

/**
 * Signed DEMO prescriptions for Rowan Testcase and Elliot Samplewood, so the chart has something
 * to renew. Made the way the app makes them: signed in as clinicianA (RLS applies), insert the
 * draft, run `evaluate_prescription_safety`, then `sign_prescription`, which also adds the active
 * medication. Skipped when the prescription with the fixed idempotency key is already signed.
 * `skip` holds idempotency keys the caller has ruled out (each is logged and left alone).
 */
export async function seedSignedPrescriptions(
  conn: SeedConnection,
  options: { skip?: ReadonlyMap<string, string> } = {},
): Promise<void> {
  await asClinicianA(conn, async (clinician) => {
    for (const plan of SIGNED_PLANS) {
      const skipReason = options.skip?.get(plan.key);
      if (skipReason) {
        console.log(`Skipped the DEMO prescription for ${plan.label}: ${skipReason}`);
        continue;
      }
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
