import "server-only";
import type { ServerSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

export type DiagnosisStatus = Database["public"]["Enums"]["diagnosis_status"];

export type DiagnosisItem = {
  id: string;
  icd10_code: string;
  description: string;
  status: DiagnosisStatus;
  recorded_on: string;
  resolved_on: string | null;
  version: number;
  recorder: { full_name: string } | null;
};

/** Active diagnoses first, then by recorded date, newest first. RLS limits them to the care team. */
export async function loadDiagnoses(supabase: ServerSupabaseClient, patientId: string): Promise<DiagnosisItem[]> {
  const { data, error } = await supabase
    .from("diagnoses")
    .select(
      "id, icd10_code, description, status, recorded_on, resolved_on, version, recorder:profiles!diagnoses_recorded_by_fkey(full_name)",
    )
    .eq("patient_id", patientId)
    .order("status", { ascending: true })
    .order("recorded_on", { ascending: false })
    .order("icd10_code", { ascending: true });
  if (error) throw new Error("Could not load the patient chart.");
  return data;
}
