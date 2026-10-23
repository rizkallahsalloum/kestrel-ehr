"use server";

import { revalidatePath } from "next/cache";
import { fail, isDbError, mapDbError, ok, validationFailure, type ActionResult } from "@/lib/actions/result";
import { authorizeAction } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { saveNoteSchema } from "./schemas";

// Public endpoint: authenticates, checks the role and validates. RLS allows the
// author to insert and update only their own note on a care-team patient; the
// table triggers set the date and version and write the audit row in the same
// transaction, so a failed audit write fails the save.

export type SavedNote = { noteId: string; version: number; savedAt: string };

export async function saveEncounterNote(input: unknown): Promise<ActionResult<SavedNote>> {
  const auth = await authorizeAction("clinician");
  if (!auth.ok) return auth.result;

  const parsed = saveNoteSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  const { patientId, noteId, expectedVersion, body } = parsed.data;

  const supabase = await createClient();

  if (noteId === null) {
    const inserted = await supabase
      .from("encounter_notes")
      .insert({ patient_id: patientId, author_id: auth.user.id, body })
      .select("id, version, saved_at")
      .single();
    if (inserted.error) {
      if (isDbError(inserted.error, "23505")) {
        return fail("CONFLICT", "You already have a note for today, saved from another tab or window. Copy your text, then reload.");
      }
      return mapDbError(inserted.error);
    }
    revalidatePath("/", "layout");
    return ok({ noteId: inserted.data.id, version: inserted.data.version, savedAt: inserted.data.saved_at });
  }

  const updated = await supabase
    .from("encounter_notes")
    .update({ body })
    .eq("id", noteId)
    .eq("patient_id", patientId)
    .eq("author_id", auth.user.id)
    .eq("version", expectedVersion!)
    .select("id, version, saved_at")
    .maybeSingle();
  if (updated.error) return mapDbError(updated.error);
  if (!updated.data) {
    return fail("CONFLICT", "This note changed in another tab or window. Copy your text, then reload.");
  }
  revalidatePath("/", "layout");
  return ok({ noteId: updated.data.id, version: updated.data.version, savedAt: updated.data.saved_at });
}
