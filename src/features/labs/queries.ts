import "server-only";
import type { ServerSupabaseClient } from "@/lib/supabase/server";
import type { Hba1cPoint } from "./chart-scale";

/** Results shown on the HbA1c chart. */
export const HBA1C_HISTORY = 12;

/** The latest HbA1c results, oldest first. RLS limits them to the caller's care team. */
export async function loadHba1c(supabase: ServerSupabaseClient, patientId: string): Promise<Hba1cPoint[]> {
  const { data, error } = await supabase
    .from("lab_results")
    .select("collected_on, value")
    .eq("patient_id", patientId)
    .eq("test", "hba1c")
    .order("collected_on", { ascending: false })
    .limit(HBA1C_HISTORY);
  if (error) throw new Error("Could not load the patient chart.");
  return data.map((row) => ({ collectedOn: row.collected_on, value: Number(row.value) })).reverse();
}
