"use client"; // Inline edit toggle, pending state and focus return around the diagnosis Server Actions.

import { useId, useRef, useState, useTransition, type FormEvent } from "react";
import { AlertTriangleIcon, Button, FormField, FormMessage, PrivateField, PrivateText, TextInput } from "@/components/ui";
import type { ActionResult } from "@/lib/actions/result";
import { setDiagnosisStatus, updateDiagnosisDescription, type DiagnosisChange } from "../actions";
import type { DiagnosisStatus } from "../queries";
import { DIAGNOSIS_DESCRIPTION_MAX } from "../schemas";

export type DiagnosisRowTarget = {
  id: string;
  code: string;
  description: string;
  status: DiagnosisStatus;
  version: number;
};

function firstError(result: ActionResult<unknown>): string {
  if (result.ok) return "";
  const errors = result.errors;
  return errors.formErrors[0] ?? Object.values(errors.fieldErrors)[0]?.[0] ?? "Something went wrong. Please try again.";
}

/** Accessible name suffix for row actions; masked like the row itself under Privacy mode. */
function RowName({ target }: { target: DiagnosisRowTarget }) {
  return (
    <span className="sr-only">
      {" "}
      <PrivateText label="Diagnosis" revealable={false}>{`${target.code} ${target.description}`}</PrivateText>
    </span>
  );
}

/**
 * Resolve or reopen, and edit the description. The row shows the new state only after the server
 * confirms it (the page re-renders from the database); errors stay next to the row.
 */
export function DiagnosisRowActions({ target }: { target: DiagnosisRowTarget }) {
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(target.description);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const editButton = useRef<HTMLButtonElement>(null);
  const inputId = useId();

  const resolved = target.status === "resolved";
  const dirty = editing && draft.trim() !== target.description;

  function toggleStatus() {
    setError(null);
    setStatus(null);
    startTransition(async () => {
      const result = await setDiagnosisStatus({
        diagnosisId: target.id,
        status: resolved ? "active" : "resolved",
        expectedVersion: target.version,
      });
      if (result.ok) setStatus(result.data.status === "resolved" ? "Diagnosis resolved." : "Diagnosis reopened.");
      else setError(firstError(result));
    });
  }

  function closeEditor() {
    setEditing(false);
    setError(null);
    requestAnimationFrame(() => editButton.current?.focus());
  }

  function saveDescription(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setStatus(null);
    startTransition(async () => {
      const result: ActionResult<DiagnosisChange> = await updateDiagnosisDescription({
        diagnosisId: target.id,
        description: draft,
        expectedVersion: target.version,
      });
      if (result.ok) {
        setStatus("Description saved.");
        closeEditor();
      } else {
        setError(firstError(result));
      }
    });
  }

  return (
    <div className="flex flex-col items-start gap-2">
      {editing ? (
        <form onSubmit={saveDescription} className="flex w-full flex-col gap-2" aria-busy={pending || undefined}>
          <FormField id={inputId} label="Description" errors={error ?? undefined}>
            <PrivateField label="Description">
              <TextInput
                value={draft}
                maxLength={DIAGNOSIS_DESCRIPTION_MAX}
                onChange={(event) => setDraft(event.target.value)}
                autoFocus
              />
            </PrivateField>
          </FormField>
          <div aria-live="polite">
            {dirty && (
              <p className="flex items-center gap-1.5 text-label-sm font-semibold text-warning">
                <AlertTriangleIcon className="size-3.5" />
                Unsaved changes
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" size="sm" disabled={pending || !dirty}>
              Save description
            </Button>
            <Button variant="quiet" size="sm" onClick={closeEditor} disabled={pending}>
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={toggleStatus} disabled={pending} aria-busy={pending || undefined}>
            {resolved ? "Reopen" : "Resolve"}
            <RowName target={target} />
          </Button>
          <Button
            ref={editButton}
            variant="quiet"
            size="sm"
            onClick={() => {
              setDraft(target.description);
              setStatus(null);
              setError(null);
              setEditing(true);
            }}
            disabled={pending}
          >
            Edit
            <RowName target={target} />
          </Button>
        </div>
      )}
      {!editing && error && <FormMessage tone="error">{error}</FormMessage>}
      <p role="status" className="text-label-sm text-ok empty:hidden">
        {status}
      </p>
    </div>
  );
}
