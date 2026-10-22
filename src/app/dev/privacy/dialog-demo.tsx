"use client"; // Dialog state and a fixed Privacy context for the specimen.

import { useState, type ReactNode } from "react";
import { Button, Dialog, FormField, PrivacyMaskContext, PrivateField, PrivateText, TextArea, TextInput } from "@/components/ui";

const noop = () => {};

/** Renders its children masked or shown regardless of the Privacy button (reference states). */
export function FixedPrivacyState({ masked, children }: { masked: boolean; children: ReactNode }) {
  return (
    <PrivacyMaskContext.Provider value={{ masked, epoch: 1, revealMs: 0, announce: noop, trackReveal: noop }}>
      {children}
    </PrivacyMaskContext.Provider>
  );
}

/** Editable private field. Client-side so `FormField` can wire its label to the textarea through `PrivateField`. */
export function PrivacyNotesDemo() {
  return (
    <FormField id="privacy-notes" label="Notes" helper="Synthetic text only. Typing keeps Privacy mode from switching on.">
      <PrivateField label="Notes">
        <TextArea rows={3} defaultValue="Synthetic note for Testcase, Rowan (SYN-000101)." />
      </PrivateField>
    </FormField>
  );
}

/** Dialog with private values: masked in place like the page; auto-hide does not close it. */
export function PrivacyDialogDemo() {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        Open dialog
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Cancel this draft?"
        description="Sample dialog with private values. Escape closes it."
      >
        <div className="flex flex-col gap-3">
          <p className="text-body-sm text-ink-strong">
            Patient: <PrivateText label="Patient name">Testcase, Rowan</PrivateText> · Medication:{" "}
            <PrivateText label="Medication">Zentoril 10 mg tablet</PrivateText>
          </p>
          <FormField id="privacy-dialog-reason" label="Reason (optional)">
            <PrivateField label="Cancel reason">
              <TextInput value={reason} onChange={(event) => setReason(event.target.value)} />
            </PrivateField>
          </FormField>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Keep draft
            </Button>
            <Button variant="danger" onClick={() => setOpen(false)}>
              Cancel draft
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
