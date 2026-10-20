import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { Dialog } from "./dialog";

function Harness({ onClose = () => {} }: { onClose?: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Open
      </button>
      <Dialog
        open={open}
        onClose={() => {
          setOpen(false);
          onClose();
        }}
        title="Cancel this draft?"
        description="Synthetic example."
      >
        <button type="button" onClick={() => setOpen(false)}>
          Keep draft
        </button>
      </Dialog>
    </>
  );
}

describe("Dialog", () => {
  it("opens as a labelled modal and returns focus to the trigger on close", () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    const trigger = screen.getByRole("button", { name: "Open" });
    trigger.focus();
    fireEvent.click(trigger);

    const dialog = screen.getByRole("dialog", { name: "Cancel this draft?" });
    expect(dialog.hasAttribute("open")).toBe(true);
    expect(dialog.getAttribute("aria-describedby")).toBe(screen.getByText("Synthetic example.").id);

    fireEvent.click(screen.getByRole("button", { name: "Keep draft" }));
    expect(dialog.hasAttribute("open")).toBe(false);
    expect(onClose).toHaveBeenCalled();
    expect(document.activeElement).toBe(trigger);
  });

  it("reports a native close, such as Escape, to the parent", () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: "Open" }));
    const dialog = screen.getByRole("dialog") as HTMLDialogElement;
    dialog.close();
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
