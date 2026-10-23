import "server-only";
import { z } from "zod";
import { requireRole } from "@/lib/auth/guards";
import { ChartAccessLogError } from "@/features/chart/queries";
import { createClient, type ServerSupabaseClient } from "@/lib/supabase/server";
import type {
  Allergy,
  MedicationOption,
  PatientMedication,
  PatientSummary,
  Prescription,
  PrescriptionAlert,
} from "@/types/domain";

const uuid = z.uuid();

/** Logs the view first (fail closed). Returns false when the caller is not on the patient's team. */
async function logAccess(supabase: ServerSupabaseClient, patientId: string): Promise<boolean> {
  const { error } = await supabase.rpc("log_patient_access", { p_patient_id: patientId });
  if (!error) return true;
  if (error.code === "42501") return false;
  throw new ChartAccessLogError();
}

async function loadPatient(supabase: ServerSupabaseClient, patientId: string): Promise<PatientSummary | null> {
  const { data, error } = await supabase
    .from("patients")
    .select("id, public_ref, mrn, given_name, family_name, date_of_birth, sex, care_team:care_teams(name)")
    .eq("id", patientId)
    .maybeSingle();
  if (error) throw new Error("Could not load the patient.");
  return data;
}

async function loadActiveMedications(supabase: ServerSupabaseClient): Promise<MedicationOption[]> {
  const { data, error } = await supabase
    .from("medications")
    .select("id, name, strength, form, drug_class_code")
    .eq("is_active", true)
    .order("name");
  if (error) throw new Error("Could not load the medication catalog.");
  return data;
}

/** What the prescriber reviews next to the form: active allergies and current medications. */
export type PatientSafetyContext = { allergies: Allergy[]; patientMedications: PatientMedication[] };

async function loadSafetyContext(supabase: ServerSupabaseClient, patientId: string): Promise<PatientSafetyContext> {
  const [allergies, patientMedications] = await Promise.all([
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
  ]);
  if (allergies.error || patientMedications.error) throw new Error("Could not load allergies and medications.");
  return { allergies: allergies.data, patientMedications: patientMedications.data };
}

export type NewPrescriptionContext = PatientSafetyContext & { patient: PatientSummary; medications: MedicationOption[] };

export async function getNewPrescriptionContext(patientId: string): Promise<NewPrescriptionContext | null> {
  await requireRole("clinician");
  if (!uuid.safeParse(patientId).success) return null;
  const supabase = await createClient();
  if (!(await logAccess(supabase, patientId))) return null;
  const [patient, medications, context] = await Promise.all([
    loadPatient(supabase, patientId),
    loadActiveMedications(supabase),
    loadSafetyContext(supabase, patientId),
  ]);
  if (!patient) return null;
  return { patient, medications, ...context };
}

export type PrescriptionWorkspace = PatientSafetyContext & {
  patient: PatientSummary;
  prescription: Prescription;
  alerts: PrescriptionAlert[];
  medications: MedicationOption[];
  prescriberName: string | null;
  isOwnPrescription: boolean;
};

export async function getPrescriptionWorkspace(
  patientId: string,
  prescriptionId: string,
): Promise<PrescriptionWorkspace | null> {
  const user = await requireRole("clinician");
  if (!uuid.safeParse(patientId).success || !uuid.safeParse(prescriptionId).success) return null;
  const supabase = await createClient();
  if (!(await logAccess(supabase, patientId))) return null;

  const [patient, prescription, medications, context] = await Promise.all([
    loadPatient(supabase, patientId),
    supabase
      .from("prescriptions")
      .select("*, medication:medications(id, name, strength, form, drug_class_code)")
      .eq("id", prescriptionId)
      .eq("patient_id", patientId)
      .maybeSingle(),
    loadActiveMedications(supabase),
    loadSafetyContext(supabase, patientId),
  ]);
  if (prescription.error) throw new Error("Could not load the prescription.");
  if (!patient || !prescription.data) return null;
  const rx = prescription.data;

  const [alerts, prescriber] = await Promise.all([
    supabase
      .from("prescription_alerts")
      .select(
        "id, severity, message, prescription_version, resolved_at, allergy_id, patient_medication_id, decision:prescription_safety_decisions(id, reason, created_at)",
      )
      .eq("prescription_id", rx.id)
      .eq("prescription_version", rx.version)
      .is("resolved_at", null)
      .order("severity")
      .order("created_at"),
    supabase.from("profiles").select("full_name").eq("id", rx.prescriber_id).maybeSingle(),
  ]);
  if (alerts.error) throw new Error("Could not load safety alerts.");

  return {
    patient,
    prescription: rx,
    alerts: alerts.data,
    medications,
    prescriberName: prescriber.data?.full_name ?? null,
    isOwnPrescription: rx.prescriber_id === user.id,
    ...context,
  };
}
