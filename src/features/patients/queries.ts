import "server-only";
import { requireRole } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import type { PatientSummary } from "@/types/domain";
import { buildQueue, type QueuePatient } from "./queue";

/** Patients on the clinician's care teams. RLS does the filtering. */
export async function listMyPatients(): Promise<PatientSummary[]> {
  await requireRole("clinician");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("patients")
    .select("id, public_ref, mrn, given_name, family_name, date_of_birth, sex, care_team:care_teams(name)")
    .order("family_name")
    .order("given_name");
  if (error) throw new Error("Could not load patients.");
  return data;
}

/**
 * Today's queue: the clinician's care-team patients (RLS) with their active allergy severities, the
 * alert state of their drafts and their latest vitals reading, in one request (embedded rows, no
 * per-patient queries). Only names and the derived status leave the server, like the patient list,
 * so it is not written to the audit log.
 */
export async function listMyQueue(): Promise<QueuePatient[]> {
  await requireRole("clinician");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("patients")
    .select(
      "id, public_ref, given_name, family_name, allergies(severity), prescriptions(status, version, last_evaluated_version, prescription_alerts(prescription_version, severity, decision:prescription_safety_decisions(id))), vital_readings(recorded_at, heart_rate, systolic, diastolic, spo2, temperature_f)",
    )
    .eq("allergies.status", "active")
    .eq("prescriptions.status", "draft")
    .is("prescriptions.prescription_alerts.resolved_at", null)
    .order("recorded_at", { referencedTable: "vital_readings", ascending: false })
    .limit(1, { referencedTable: "vital_readings" });
  if (error) throw new Error("Could not load the patient queue.");
  return buildQueue(data);
}
