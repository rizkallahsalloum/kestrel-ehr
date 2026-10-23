import "server-only";
import { z } from "zod";
import { requireRole } from "@/lib/auth/guards";
import { createClient, type ServerSupabaseClient } from "@/lib/supabase/server";
import type { Allergy, DraftAlertRow, PatientMedication, PatientSummary, PrescriptionListItem } from "@/types/domain";

export type PatientChart = {
  patient: PatientSummary;
  allergies: Allergy[];
  medications: PatientMedication[];
  prescriptions: PrescriptionListItem[];
  /** Unresolved alerts on drafts, any version; see features/chart/alerts.ts for what counts. */
  draftAlerts: DraftAlertRow[];
};

export class ChartAccessLogError extends Error {
  constructor() {
    super("The chart view could not be recorded in the audit log, so the chart was not loaded.");
    this.name = "ChartAccessLogError";
  }
}

const patientIdSchema = z.uuid();

/**
 * Loads a chart for the given client. The view is written to the audit log
 * before any clinical data is read; if that fails the chart is not returned
 * (fail closed). Returns null when the patient is unknown or not on the
 * caller's care team, so both cases look the same to the caller.
 */
export async function loadPatientChart(
  supabase: ServerSupabaseClient,
  patientId: string,
): Promise<PatientChart | null> {
  if (!patientIdSchema.safeParse(patientId).success) return null;

  const logged = await supabase.rpc("log_patient_access", { p_patient_id: patientId });
  if (logged.error) {
    if (logged.error.code === "42501") return null;
    throw new ChartAccessLogError();
  }

  const [patient, allergies, medications, prescriptions] = await Promise.all([
    supabase
      .from("patients")
      .select("id, public_ref, mrn, given_name, family_name, date_of_birth, sex, care_team:care_teams(name)")
      .eq("id", patientId)
      .maybeSingle(),
    supabase
      .from("allergies")
      .select("id, substance_text, reaction, severity, drug_class_code, status")
      .eq("patient_id", patientId)
      .eq("status", "active")
      .order("severity", { ascending: false }),
    supabase
      .from("patient_medications")
      .select("id, dose_text, start_date, status, source_prescription_id, medication:medications(name, strength, form)")
      .eq("patient_id", patientId)
      .eq("status", "active")
      .order("start_date", { ascending: false }),
    supabase
      .from("prescriptions")
      .select(
        "id, public_ref, status, version, last_evaluated_version, quantity, start_date, created_at, signed_at, prescriber_id, medication:medications(name, strength, form)",
      )
      .eq("patient_id", patientId)
      .order("created_at", { ascending: false }),
  ]);

  if (patient.error || allergies.error || medications.error || prescriptions.error) {
    throw new Error("Could not load the patient chart.");
  }
  if (!patient.data) return null;

  const draftIds = prescriptions.data.filter((rx) => rx.status === "draft").map((rx) => rx.id);
  let draftAlerts: DraftAlertRow[] = [];
  if (draftIds.length > 0) {
    const alerts = await supabase
      .from("prescription_alerts")
      .select("id, prescription_id, prescription_version, severity, message, decision:prescription_safety_decisions(id)")
      .in("prescription_id", draftIds)
      .is("resolved_at", null);
    if (alerts.error) throw new Error("Could not load the patient chart.");
    draftAlerts = alerts.data;
  }

  return {
    patient: patient.data,
    allergies: allergies.data,
    medications: medications.data,
    prescriptions: prescriptions.data,
    draftAlerts,
  };
}

export async function getPatientChart(patientId: string): Promise<PatientChart | null> {
  await requireRole("clinician");
  return loadPatientChart(await createClient(), patientId);
}
