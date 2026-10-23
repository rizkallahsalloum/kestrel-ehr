"use client"; // Dev specimen: the notes editor with an in-memory save instead of the Server Action.

import { useRef } from "react";
import { NotesEditor, type NoteSnapshot } from "@/features/encounter-notes/components/notes-editor";
import type { SaveNoteInput } from "@/features/encounter-notes/schemas";
import { fail, ok } from "@/lib/actions/result";

export type StubSaveMode = "ok" | "fail" | "conflict";

/** Saves resolve after a short delay; `mode` makes every save fail or conflict, for review and tests. */
export function StubNotesEditor({ initial, mode }: { initial: NoteSnapshot | null; mode: StubSaveMode }) {
  const version = useRef(initial?.version ?? 0);
  async function save(input: SaveNoteInput) {
    await new Promise((resolve) => setTimeout(resolve, 400));
    if (mode === "fail") return fail("INTERNAL", "Something went wrong. Please try again.");
    if (mode === "conflict") return fail("CONFLICT", "This note changed in another tab or window. Copy your text, then reload.");
    version.current += 1;
    return ok({
      noteId: input.noteId ?? "00000000-0000-4000-8000-000000000699",
      version: version.current,
      savedAt: new Date().toISOString(),
    });
  }
  return <NotesEditor patientId="00000000-0000-4000-8000-000000000101" initial={initial} save={save} />;
}
