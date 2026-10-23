import pg from "pg";
import { SEED_SIGNED } from "../../scripts/fixtures.ts";
import { loadTestEnv } from "../../scripts/test-env.ts";

/**
 * Removes prescriptions created by previous integration or e2e runs so that
 * safety-rule expectations stay deterministic. Seeded fixtures (including the
 * seeded signed prescriptions and the medications they created) and the
 * append-only audit log are left untouched.
 */
export async function resetPrescriptionData(): Promise<void> {
  const keep = Object.values(SEED_SIGNED);
  const client = new pg.Client({ connectionString: loadTestEnv().dbUrl });
  await client.connect();
  try {
    await client.query("begin");
    await client.query(
      "create temporary table reset_targets on commit drop as select id from public.prescriptions where not (idempotency_key = any ($1::uuid[]))",
      [keep],
    );
    await client.query(
      "delete from public.prescription_safety_decisions where alert_id in (select a.id from public.prescription_alerts a join reset_targets t on t.id = a.prescription_id)",
    );
    await client.query("delete from public.prescription_alerts where prescription_id in (select id from reset_targets)");
    await client.query("delete from public.patient_medications where source_prescription_id in (select id from reset_targets)");
    await client.query("delete from public.prescriptions where id in (select id from reset_targets)");
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    await client.end();
  }
}
