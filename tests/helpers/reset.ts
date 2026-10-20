import pg from "pg";
import { loadTestEnv } from "../../scripts/test-env.ts";

/**
 * Removes prescriptions created by previous integration or e2e runs so that
 * safety-rule expectations stay deterministic. Seeded fixtures and the
 * append-only audit log are left untouched.
 */
export async function resetPrescriptionData(): Promise<void> {
  const client = new pg.Client({ connectionString: loadTestEnv().dbUrl });
  await client.connect();
  try {
    await client.query("begin");
    await client.query("delete from public.prescription_safety_decisions");
    await client.query("delete from public.prescription_alerts");
    await client.query("delete from public.patient_medications where source_prescription_id is not null");
    await client.query("delete from public.prescriptions");
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    await client.end();
  }
}
