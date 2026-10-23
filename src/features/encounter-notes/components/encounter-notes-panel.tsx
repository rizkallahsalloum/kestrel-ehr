import type { ReactNode } from "react";
import { Card, EmptyState, PrivateText, SkeletonBlock, SkeletonLine } from "@/components/ui";
import { formatDate } from "@/lib/format";
import type { EncounterNotes } from "../queries";
import { NotesEditor, type NoteSnapshot } from "./notes-editor";

const NOTES_TITLE = "Encounter notes";
const NOTES_DESCRIPTION = "Synthetic notes. One note per clinician and day; dates follow UTC.";

/** The card with a placeholder editor and one note, for the chart skeleton (inside `aria-hidden`). */
export function EncounterNotesSkeleton() {
  return (
    <div className="rounded-card border border-line-subtle bg-surface p-5 shadow-level-1">
      <div className="mb-3">
        <p className="text-heading-sm font-semibold text-ink">{NOTES_TITLE}</p>
        <p className="mt-0.5 text-label-sm text-ink-muted">{NOTES_DESCRIPTION}</p>
      </div>
      <SkeletonLine className="text-label" width="w-36" />
      <SkeletonBlock className="mt-1.5 h-27 w-full" />
      <SkeletonLine className="mt-1.5 text-label-sm" width="w-72 max-w-full" />
      <SkeletonBlock className="mt-2 min-h-control-sm w-40" />
      <p className="mt-5 mb-2 text-label font-semibold text-ink">Recent notes</p>
      <SkeletonLine className="text-label-sm" width="w-40" />
      <SkeletonLine className="mt-1 text-body-sm" width="w-full" />
    </div>
  );
}

/**
 * The caller's own note for today (autosaved) and the latest notes on the patient, read-only.
 * One note per clinician, patient and UTC day.
 */
export function EncounterNotesPanel({
  patientId,
  notes,
  editor,
}: {
  patientId: string;
  notes: EncounterNotes;
  /** Replaces the editor (dev specimens pass one with a stubbed save). */
  editor?: ReactNode;
}) {
  const own: NoteSnapshot | null = notes.ownToday
    ? {
        noteId: notes.ownToday.id,
        version: notes.ownToday.version,
        body: notes.ownToday.body,
        savedAt: notes.ownToday.saved_at,
      }
    : null;
  return (
    <Card elevated title={NOTES_TITLE} description={NOTES_DESCRIPTION}>
      {editor ?? <NotesEditor key={patientId} patientId={patientId} initial={own} />}
      <h3 className="mt-5 mb-2 text-label font-semibold text-ink">Recent notes</h3>
      {notes.recent.length === 0 ? (
        <EmptyState>No earlier or team notes yet.</EmptyState>
      ) : (
        <ul aria-label="Recent notes" className="flex flex-col">
          {notes.recent.map((note) => (
            <li key={note.id} className="border-t border-line-subtle py-3 first:border-t-0 first:pt-0">
              <p className="text-label-sm text-ink-secondary">
                {note.author?.full_name ?? "A care-team clinician"} ·{" "}
                <PrivateText label="Note date" className="whitespace-nowrap">{formatDate(note.note_date)}</PrivateText>
              </p>
              <PrivateText label="Note" block className="mt-1 text-body-sm whitespace-pre-wrap text-ink">
                {note.body}
              </PrivateText>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
