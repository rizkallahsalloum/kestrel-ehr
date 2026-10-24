"use client"; // Calls the toast hook and opens a dialog from button clicks.

import { useEffect, useRef, useState } from "react";
import { Button, Dialog, useToast } from "@/components/ui";
import { ActionOutcome } from "@/features/prescriptions/components/action-outcome";
import { OUTCOME_TOAST } from "@/features/prescriptions/outcome-text";

const MESSAGES = Object.values(OUTCOME_TOAST);

/** What the E-Rx view's hidden ActionOutcome says after each action's refresh. */
const ANNOUNCED: Record<keyof typeof OUTCOME_TOAST, string> = {
  "draft-saved": "Draft saved as version 2.",
  "alert-acknowledged": "0 open, 1 acknowledged",
  "prescription-signed": "Prescription signed (simulated).",
  "draft-cancelled": "Draft cancelled.",
};
const ACTION_LABEL: Record<keyof typeof OUTCOME_TOAST, string> = {
  "draft-saved": "Save draft",
  "alert-acknowledged": "Acknowledge",
  "prescription-signed": "Sign",
  "draft-cancelled": "Cancel",
};
const OUTCOMES = Object.keys(OUTCOME_TOAST) as (keyof typeof OUTCOME_TOAST)[];

/** `show`: one toast, four at once (three on screen, one waiting), or one added while a dialog is open. */
export function ToastDemo({ show }: { show?: "one" | "four" | "dialog" }) {
  const notify = useToast();
  const [dialogOpen, setDialogOpen] = useState(show === "dialog");
  const [announced, setAnnounced] = useState("");
  const started = useRef(false);

  // The dialog's own effect (a child) has opened it by now, so the "dialog" toast waits.
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (show === "one" || show === "dialog") notify(MESSAGES[0]!);
    if (show === "four") MESSAGES.forEach((message) => notify(message));
  }, [show, notify]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {MESSAGES.map((message) => (
          <Button key={message} variant="secondary" size="sm" onClick={() => notify(message)}>
            Show “{message}”
          </Button>
        ))}
        <Button variant="secondary" size="sm" onClick={() => MESSAGES.forEach((message) => notify(message))}>
          Show all four
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            setDialogOpen(true);
            notify(OUTCOME_TOAST["draft-cancelled"]);
          }}
        >
          Open a dialog, then add a toast
        </Button>
      </div>
      {/* The E-Rx pairing: the hidden ActionOutcome announces, the toast is visual only. */}
      <div className="flex flex-wrap gap-2">
        {OUTCOMES.map((outcome) => (
          <Button
            key={outcome}
            variant="secondary"
            size="sm"
            onClick={() => {
              setAnnounced(ANNOUNCED[outcome]);
              notify(OUTCOME_TOAST[outcome]);
            }}
          >
            Simulate {ACTION_LABEL[outcome]}
          </Button>
        ))}
      </div>
      <ActionOutcome message={announced} focusId="toast-specimen-title" className="sr-only" />
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title="Specimen dialog">
        <p className="text-body-sm">Toasts wait while this dialog is open.</p>
        <Button className="mt-4" variant="secondary" onClick={() => setDialogOpen(false)}>
          Close
        </Button>
      </Dialog>
    </div>
  );
}
