import { z } from "zod";

/** Same limit as the `encounter_notes.body` check constraint. */
export const NOTE_BODY_MAX = 5000;

/**
 * One autosave. Without `noteId` it creates the caller's note for today, which needs some text;
 * with `noteId` and `expectedVersion` it replaces the body of that note (an empty body is allowed,
 * so clearing the text is saved too). The body is stored as typed, not trimmed.
 */
export const saveNoteSchema = z
  .object({
    patientId: z.uuid(),
    noteId: z.uuid().nullable(),
    expectedVersion: z.number().int().min(1).nullable(),
    body: z.string().max(NOTE_BODY_MAX, `Notes are limited to ${NOTE_BODY_MAX} characters.`),
  })
  .refine((input) => (input.noteId === null) === (input.expectedVersion === null), {
    message: "A saved note needs its version.",
    path: ["expectedVersion"],
  })
  .refine((input) => input.noteId !== null || input.body.trim().length > 0, {
    message: "Type a note before saving.",
    path: ["body"],
  });

export type SaveNoteInput = z.infer<typeof saveNoteSchema>;
