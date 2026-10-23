import "server-only";
import type { ServerSupabaseClient } from "@/lib/supabase/server";
import type { VitalReading } from "./thresholds";

/** Readings per sparkline; the latest of them is the tile value. */
export const VITALS_HISTORY = 6;

/** The latest readings, oldest first. RLS limits them to the caller's care team. */
export async function loadVitals(supabase: ServerSupabaseClient, patientId: string): Promise<VitalReading[]> {
  const { data, error } = await supabase
    .from("vital_readings")
    .select("recorded_at, heart_rate, systolic, diastolic, spo2, temperature_f")
    .eq("patient_id", patientId)
    .order("recorded_at", { ascending: false })
    .limit(VITALS_HISTORY);
  if (error) throw new Error("Could not load the patient chart.");
  return data.reverse();
}
