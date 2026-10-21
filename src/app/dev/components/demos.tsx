"use client";

import { useState } from "react";
import { Button, Combobox, Dialog, FormErrors, FormField, TextInput, type ComboboxOption } from "@/components/ui";

const DEMO_MEDICATIONS: ComboboxOption[] = [
  { value: "m1", label: "Demozolam 5 mg tablet", description: "Synthetic catalog", meta: "DEMO-AAA" },
  { value: "m2", label: "Demozolam 10 mg tablet", description: "Synthetic catalog", meta: "DEMO-AAA" },
  { value: "m3", label: "Testoprilat 20 mg tablet", description: "Synthetic catalog", meta: "DEMO-BBB" },
  { value: "m4", label: "Placebrex 250 mg capsule", description: "Synthetic catalog", meta: "DEMO-CCC" },
];

export function ComboboxDemo() {
  const [value, setValue] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-2">
      <FormField id="demo-medication" label="Medication (combobox)" required helper="Type to filter, arrow keys to move, Enter to pick.">
        <Combobox
          options={DEMO_MEDICATIONS}
          value={value}
          onValueChange={setValue}
          placeholder="Search synthetic medications"
          size="lg"
        />
      </FormField>
      <p className="text-label-sm text-ink-secondary">Selected value: {value ?? "none"}</p>
    </div>
  );
}

export function ComboboxStatusDemo({ status }: { status: "loading" | "error" }) {
  return (
    <FormField id={`demo-status-${status}`} label={status === "loading" ? "Loading state" : "Error state"}>
      <Combobox options={[]} value={null} onValueChange={() => {}} status={status} placeholder="Focus to see the panel" />
    </FormField>
  );
}

/** Errors that appear after a submit, the way a failed Server Action shows them. */
export function SubmitErrorsDemo() {
  const [submitted, setSubmitted] = useState(false);
  return (
    <form
      noValidate
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        setSubmitted(true);
      }}
    >
      {submitted && <FormErrors messages={["The draft changed since you opened it. Reload to see the latest version."]} />}
      <FormField id="demo-submit-quantity" label="Quantity" required errors={submitted ? "Enter a whole number of 1 or more." : undefined}>
        <TextInput type="number" inputMode="numeric" />
      </FormField>
      <div>
        <Button type="submit" variant="secondary" size="sm">
          Submit with errors
        </Button>
      </div>
    </form>
  );
}

export function DialogDemo() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        Open dialog
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Cancel this draft?"
        description="Sample dialog. Escape closes it and focus returns to the button."
      >
        <div className="flex flex-col gap-3">
          <FormField id="demo-dialog-reason" label="Reason (optional)">
            <TextInput />
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
