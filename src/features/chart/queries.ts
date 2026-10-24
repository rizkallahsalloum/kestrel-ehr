import "server-only";
import { cache } from "react";
import { z } from "zod";
import { requireRole } from "@/lib/auth/guards";
import { createClient, type ServerSupabaseClient } from "@/lib/supabase/server";
import { loadDiagnoses, type DiagnosisItem } from "@/features/diagnoses/queries";
import { loadEncounterNotes, type EncounterNotes } from "@/features/encounter-notes/queries";
import type { Hba1cPoint } from "@/features/labs/chart-scale";
import { loadHba1c } from "@/features/labs/queries";
import { loadVitals } from "@/features/vitals/queries";
import type { VitalReading } from "@/features/vitals/thresholds";
import type { Allergy, DraftAlertRow, PatientMedication, PatientSummary, PrescriptionListItem } from "@/types/domain";

export type PatientChart = {
  patient: PatientSummary;
  allergies: Allergy[];
  medications: PatientMedication[];
  prescriptions: PrescriptionListItem[];
  /** Unresolved alerts on drafts, any version; see features/chart/alerts.ts for what counts. */
  draftAlerts: DraftAlertRow[];
  /** The latest readings, oldest first. */
  vitals: VitalReading[];
  /** HbA1c results, oldest first. */
  hba1c: Hba1cPoint[];
  diagnoses: DiagnosisItem[];
  notes: EncounterNotes;
};

export class ChartAccessLogError extends Error {
  constructor() {
    super("The chart view could not be recorded in the audit log, so the chart was not loaded.");
    this.name = "ChartAccessLogError";
  }
}

/** The patient header and the allergy column: identity, active allergies, diagnoses. */
export type ChartHeader = Pick<PatientChart, "patient" | "allergies" | "diagnoses">;
/** What the alert slot needs; the chart below reuses it (prescriptions, vitals). */
export type ChartAlertData = Pick<PatientChart, "prescriptions" | "draftAlerts" | "vitals">;
/** Everything else, which streams in behind the skeleton. */
export type ChartRest = Pick<PatientChart, "medications" | "hba1c" | "notes">;

const patientIdSchema = z.uuid();
const LOAD_FAILED = "Could not load the patient chart.";

/**
 * Writes the chart view to the audit log. Must run, and succeed, before any clinical read: a
 * failed write throws (fail closed). False when the patient is unknown or not on the caller's care
 * team (42501), so both cases look the same to the caller.
 */
async function logChartAccess(supabase: ServerSupabaseClient, patientId: string): Promise<boolean> {
  const logged = await supabase.rpc("log_patient_access", { p_patient_id: patientId });
  if (!logged.error) return true;
  if (logged.error.code === "42501") return false;
  throw new ChartAccessLogError();
}

/** Call only after `logChartAccess`. Null when RLS hides the patient row. */
export async function loadChartHeader(supabase: ServerSupabaseClient, patientId: string): Promise<ChartHeader | null> {
  const [patient, allergies, diagnoses] = await Promise.all([
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
    loadDiagnoses(supabase, patientId),
  ]);
  if (patient.error || allergies.error) throw new Error(LOAD_FAILED);
  if (!patient.data) return null;
  return { patient: patient.data, allergies: allergies.data, diagnoses };
}

/** Call only after `logChartAccess`. */
export async function loadChartAlertData(supabase: ServerSupabaseClient, patientId: string): Promise<ChartAlertData> {
  const [prescriptions, vitals] = await Promise.all([
    supabase
      .from("prescriptions")
      .select(
        "id, public_ref, status, version, last_evaluated_version, quantity, start_date, created_at, signed_at, prescriber_id, medication:medications(name, strength, form)",
      )
      .eq("patient_id", patientId)
      .order("created_at", { ascending: false }),
    loadVitals(supabase, patientId),
  ]);
  if (prescriptions.error) throw new Error(LOAD_FAILED);

  const draftIds = prescriptions.data.filter((rx) => rx.status === "draft").map((rx) => rx.id);
  let draftAlerts: DraftAlertRow[] = [];
  if (draftIds.length > 0) {
    const alerts = await supabase
      .from("prescription_alerts")
      .select("id, prescription_id, prescription_version, severity, message, decision:prescription_safety_decisions(id)")
      .in("prescription_id", draftIds)
      .is("resolved_at", null);
    if (alerts.error) throw new Error(LOAD_FAILED);
    draftAlerts = alerts.data;
  }
  return { prescriptions: prescriptions.data, draftAlerts, vitals };
}

/** Call only after `logChartAccess`. `viewerId` picks out the caller's own note for today. */
export async function loadChartRest(
  supabase: ServerSupabaseClient,
  patientId: string,
  viewerId: string | null,
): Promise<ChartRest> {
  const [medications, hba1c, notes] = await Promise.all([
    supabase
      .from("patient_medications")
      .select(
        "id, dose_text, start_date, status, source_prescription_id, medication:medications(name, strength, form), source:prescriptions!patient_medications_source_prescription_fkey(public_ref, status)",
      )
      .eq("patient_id", patientId)
      .eq("status", "active")
      .order("start_date", { ascending: false }),
    loadHba1c(supabase, patientId),
    loadEncounterNotes(supabase, patientId, viewerId),
  ]);
  if (medications.error) throw new Error(LOAD_FAILED);
  return { medications: medications.data, hba1c, notes };
}

/**
 * Loads a whole chart for the given client: the audit write first, then every read. Returns null
 * when the patient is unknown or not on the caller's care team.
 */
export async function loadPatientChart(
  supabase: ServerSupabaseClient,
  patientId: string,
  viewerId: string | null = null,
): Promise<PatientChart | null> {
  if (!patientIdSchema.safeParse(patientId).success) return null;
  if (!(await logChartAccess(supabase, patientId))) return null;
  const [header, alertData, rest] = await Promise.all([
    loadChartHeader(supabase, patientId),
    loadChartAlertData(supabase, patientId),
    loadChartRest(supabase, patientId, viewerId),
  ]);
  return header && { ...header, ...alertData, ...rest };
}

/*
 * The chart page renders the header and the alert slot first and streams the rest, from separate
 * components that share these loaders. React `cache()` memoizes them for one server request only
 * (no cross-request or persistent cache, so no stale clinical data): one audit write and one read
 * of each table per page render.
 */

/** The signed-in clinician's client after the audit write; null when the patient is not theirs. */
const chartAccess = cache(async (patientId: string) => {
  const user = await requireRole("clinician");
  if (!patientIdSchema.safeParse(patientId).success) return null;
  const supabase = await createClient();
  return (await logChartAccess(supabase, patientId)) ? { supabase, viewerId: user.id } : null;
});

export const getChartHeader = cache(async (patientId: string): Promise<ChartHeader | null> => {
  const access = await chartAccess(patientId);
  return access && loadChartHeader(access.supabase, patientId);
});

export const getChartAlertData = cache(async (patientId: string): Promise<ChartAlertData | null> => {
  const access = await chartAccess(patientId);
  return access && loadChartAlertData(access.supabase, patientId);
});

export const getChartRest = cache(async (patientId: string): Promise<ChartRest | null> => {
  const access = await chartAccess(patientId);
  return access && loadChartRest(access.supabase, patientId, access.viewerId);
});

/** Starts the slower reads early, alongside the header; a failure surfaces where they are awaited. */
export function preloadChart(patientId: string): void {
  getChartAlertData(patientId).catch(() => {});
  getChartRest(patientId).catch(() => {});
}
