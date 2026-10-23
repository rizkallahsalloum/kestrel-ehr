"use client"; // Autosave timers, one save in flight, and the live save status for the note textarea.

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { AlertTriangleIcon, Button, CheckCircleIcon, cn, FormField, PrivateField, Spinner, TextArea } from "@/components/ui";
import type { ActionResult } from "@/lib/actions/result";
import { saveEncounterNote, type SavedNote } from "../actions";
import { NOTE_BODY_MAX, type SaveNoteInput } from "../schemas";

/** Save after this long without typing. */
export const NOTE_IDLE_MS = 1500;
/** While typing continues, save at least this often. */
export const NOTE_MAX_WAIT_MS = 10_000;

export type NoteSnapshot = { noteId: string; version: number; body: string; savedAt: string };

type Phase = "clean" | "dirty" | "saving" | "error" | "conflict";

const TIME = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" });

/**
 * The clinician's own note for today. Saves itself after a pause in typing; "Saved" appears only
 * after the server confirms a save, and anything typed since shows "Unsaved changes". A version
 * conflict (the note changed in another tab) stops autosave and keeps the typed text.
 */
export function NotesEditor({
  patientId,
  initial,
  save = saveEncounterNote,
}: {
  patientId: string;
  initial: NoteSnapshot | null;
  save?: (input: SaveNoteInput) => Promise<ActionResult<SavedNote>>;
}) {
  const fieldId = useId();
  const [body, setBody] = useState(initial?.body ?? "");
  const [saved, setSaved] = useState<NoteSnapshot | null>(initial);
  const [phase, setPhase] = useState<Phase>("clean");
  const [error, setError] = useState<string | null>(null);

  const bodyRef = useRef(body);
  const savedRef = useRef(saved);
  const inFlight = useRef(false);
  const stopped = useRef(false);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const maxTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = useCallback(() => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    if (maxTimer.current) clearTimeout(maxTimer.current);
    idleTimer.current = null;
    maxTimer.current = null;
  }, []);

  const flushRef = useRef<() => Promise<void>>(async () => {});

  const schedule = useCallback(() => {
    if (stopped.current) return;
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => void flushRef.current(), NOTE_IDLE_MS);
    maxTimer.current ??= setTimeout(() => void flushRef.current(), NOTE_MAX_WAIT_MS);
  }, []);

  const flush = useCallback(async () => {
    clearTimers();
    if (inFlight.current || stopped.current) return;
    const snapshot = bodyRef.current;
    const current = savedRef.current;
    if (snapshot === (current?.body ?? "")) {
      setPhase("clean");
      return;
    }
    // Nothing to create yet: an empty new note is not saved.
    if (!current && snapshot.trim() === "") return;

    inFlight.current = true;
    setPhase("saving");
    setError(null);
    const result = await save({
      patientId,
      noteId: current?.noteId ?? null,
      expectedVersion: current?.version ?? null,
      body: snapshot,
    });
    inFlight.current = false;

    if (!result.ok) {
      const message =
        result.errors.formErrors[0] ??
        Object.values(result.errors.fieldErrors)[0]?.[0] ??
        "Something went wrong. Please try again.";
      if (result.errors.code === "CONFLICT") stopped.current = true;
      setError(message);
      setPhase(result.errors.code === "CONFLICT" ? "conflict" : "error");
      return;
    }

    const next = { noteId: result.data.noteId, version: result.data.version, body: snapshot, savedAt: result.data.savedAt };
    savedRef.current = next;
    setSaved(next);
    if (bodyRef.current === snapshot) {
      setPhase("clean");
    } else {
      setPhase("dirty");
      schedule();
    }
  }, [clearTimers, patientId, save, schedule]);

  useEffect(() => {
    flushRef.current = flush;
  }, [flush]);

  useEffect(() => clearTimers, [clearTimers]);

  const unsaved = phase === "dirty" || phase === "saving" || phase === "error" || phase === "conflict";
  useEffect(() => {
    if (!unsaved) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [unsaved]);

  function onChange(value: string) {
    bodyRef.current = value;
    setBody(value);
    if (stopped.current) return;
    const clean = value === (savedRef.current?.body ?? "");
    if (!inFlight.current) setPhase(clean ? "clean" : "dirty");
    if (clean) clearTimers();
    else schedule();
  }

  return (
    <div className="flex flex-col gap-2">
      <FormField
        id={fieldId}
        label="Your note for today"
        helper="Synthetic text only. Saves automatically; visible to your care team."
      >
        <PrivateField label="Note">
          <TextArea
            value={body}
            maxLength={NOTE_BODY_MAX}
            rows={4}
            onChange={(event) => onChange(event.target.value)}
            onBlur={() => {
              if (phase === "dirty") void flush();
            }}
          />
        </PrivateField>
      </FormField>
      <SaveStatus phase={phase} saved={saved} error={error} onRetry={() => void flush()} />
    </div>
  );
}

function SaveStatus({
  phase,
  saved,
  error,
  onRetry,
}: {
  phase: Phase;
  saved: NoteSnapshot | null;
  error: string | null;
  onRetry: () => void;
}) {
  const warning = phase === "dirty" || phase === "error" || phase === "conflict";
  return (
    <div
      data-save-state={phase}
      className={cn(
        "flex min-h-control-sm items-center gap-2 rounded-panel border px-3 py-1.5 text-label",
        warning ? "border-warning-line bg-warning-subtle font-semibold text-warning" : "border-transparent text-ink-secondary",
      )}
    >
      <p aria-live="polite" className="flex min-w-0 flex-1 items-center gap-2">
        {phase === "dirty" && (
          <>
            <AlertTriangleIcon className="size-3.5 shrink-0" />
            Unsaved changes
          </>
        )}
        {phase === "saving" && (
          <>
            <Spinner className="size-3.5 shrink-0" />
            Saving…
          </>
        )}
        {phase === "clean" &&
          (saved ? (
            <>
              <CheckCircleIcon className="size-3.5 shrink-0 text-ok" />
              Saved {TIME.format(new Date(saved.savedAt))} UTC
            </>
          ) : (
            "No note for today yet"
          ))}
      </p>
      {(phase === "error" || phase === "conflict") && (
        <>
          <p role="alert" className="flex min-w-0 flex-1 items-start gap-2">
            <AlertTriangleIcon className="mt-0.5 size-3.5 shrink-0" />
            Not saved. {error}
          </p>
          {phase === "error" && (
            <Button variant="secondary" size="sm" onClick={onRetry}>
              Retry save
            </Button>
          )}
        </>
      )}
    </div>
  );
}
