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
    .select("id, mrn, given_name, family_name, date_of_birth, sex, care_team:care_teams(name)")
    .order("family_name")
    .order("given_name");
  if (error) throw new Error("Could not load patients.");
  return data;
}

/**
 * Today's queue: the clinician's care-team patients (RLS) with the alert state of their drafts, in
 * one request (embedded drafts and their unresolved alerts, no per-patient queries). Reads names and
 * alert severities only, like the patient list, so it is not written to the audit log.
 */
export async function listMyQueue(): Promise<QueuePatient[]> {
  await requireRole("clinician");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("patients")
    .select(
      "id, given_name, family_name, prescriptions(status, version, last_evaluated_version, prescription_alerts(prescription_version, severity, decision:prescription_safety_decisions(id)))",
    )
    .eq("prescriptions.status", "draft")
    .is("prescriptions.prescription_alerts.resolved_at", null);
  if (error) throw new Error("Could not load the patient queue.");
  return buildQueue(data);
}
