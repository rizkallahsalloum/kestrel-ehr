"use client"; // Calls the toast hook and opens a dialog from button clicks.

import { useEffect, useRef, useState } from "react";
import { Button, Dialog, useToast } from "@/components/ui";
import { OUTCOME_TOAST } from "@/features/prescriptions/outcome-text";

const MESSAGES = Object.values(OUTCOME_TOAST);

/** `show`: one toast, four at once (three on screen, one waiting), or one added while a dialog is open. */
export function ToastDemo({ show }: { show?: "one" | "four" | "dialog" }) {
  const notify = useToast();
  const [dialogOpen, setDialogOpen] = useState(show === "dialog");
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
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title="Specimen dialog">
        <p className="text-body-sm">Toasts wait while this dialog is open.</p>
        <Button className="mt-4" variant="secondary" onClick={() => setDialogOpen(false)}>
          Close
        </Button>
      </Dialog>
    </div>
  );
}
