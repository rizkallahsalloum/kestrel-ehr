import "server-only";
import type { ServerSupabaseClient } from "@/lib/supabase/server";

export type EncounterNote = {
  id: string;
  author_id: string;
  note_date: string;
  body: string;
  version: number;
  saved_at: string;
  author: { full_name: string } | null;
};

export type EncounterNotes = {
  /** The latest team notes, newest first. */
  recent: EncounterNote[];
  /** The caller's own note dated today (UTC), which the editor continues. */
  ownToday: EncounterNote | null;
};

/** Team notes listed on the chart. */
export const NOTES_HISTORY = 5;

const COLUMNS = "id, author_id, note_date, body, version, saved_at, author:profiles!encounter_notes_author_id_fkey(full_name)";

/** Today as the database's `current_date` sees it: notes are dated in UTC. */
export function noteDateToday(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/** RLS limits both reads to the caller's care team. */
export async function loadEncounterNotes(
  supabase: ServerSupabaseClient,
  patientId: string,
  viewerId: string | null,
): Promise<EncounterNotes> {
  const today = noteDateToday();
  const [recent, own] = await Promise.all([
    supabase
      .from("encounter_notes")
      .select(COLUMNS)
      .eq("patient_id", patientId)
      .order("note_date", { ascending: false })
      .order("saved_at", { ascending: false })
      .limit(NOTES_HISTORY + 1),
    viewerId
      ? supabase
          .from("encounter_notes")
          .select(COLUMNS)
          .eq("patient_id", patientId)
          .eq("author_id", viewerId)
          .eq("note_date", today)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  if (recent.error || own.error) throw new Error("Could not load the patient chart.");
  const ownToday = own.data;
  return {
    recent: recent.data.filter((note) => note.id !== ownToday?.id).slice(0, NOTES_HISTORY),
    ownToday,
  };
}
