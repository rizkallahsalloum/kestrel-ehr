"use client";

import { useState } from "react";
import { Button, Dialog, PrivateText } from "@/components/ui";

/** Client-only preview of the saved version as label text. Nothing is printed or sent. */
export function LabelPreviewButton({ lines, className }: { lines: string[]; className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" className={className} onClick={() => setOpen(true)}>
        Preview label
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Label preview"
        description="Simulated label for the saved version. Nothing is printed or sent."
      >
        <p className="my-3 rounded-panel bg-surface-warm p-3.5 font-mono text-code-md whitespace-pre-line text-ink">
          <PrivateText label="Label text" block>
            {lines.slice(0, -1).join("\n")}
          </PrivateText>
          {lines.at(-1)}
        </p>
        <div className="flex justify-end">
          <Button onClick={() => setOpen(false)}>Close</Button>
        </div>
      </Dialog>
    </>
  );
}
