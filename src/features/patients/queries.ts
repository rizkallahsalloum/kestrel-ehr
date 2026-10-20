import "server-only";
import { requireRole } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import type { PatientSummary } from "@/types/domain";

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
