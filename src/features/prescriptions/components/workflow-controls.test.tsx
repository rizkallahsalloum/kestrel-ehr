import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ActionResult } from "@/lib/actions/result";

const cancelFormAction = vi.fn<(previous: unknown, formData: FormData) => Promise<ActionResult<{ prescriptionId: string }>>>();

vi.mock("../actions", () => ({
  acknowledgeFormAction: vi.fn(),
  evaluateFormAction: vi.fn(),
  signFormAction: vi.fn(),
  cancelFormAction: (previous: unknown, formData: FormData) => cancelFormAction(previous, formData),
}));

const { CancelDraftDialog } = await import("./workflow-controls");

const IDS = { patientId: "11111111-1111-4111-8111-111111111111", prescriptionId: "22222222-2222-4222-8222-222222222222" };

function renderDialog() {
  render(<CancelDraftDialog {...IDS} expectedVersion={3} />);
  const trigger = screen.getByRole("button", { name: "Cancel this draft" });
  trigger.focus();
  fireEvent.click(trigger);
  const dialog = document.querySelector("dialog")!;
  return { trigger, dialog };
}

describe("CancelDraftDialog", () => {
  beforeEach(() => cancelFormAction.mockReset());

  it("Keep draft closes the dialog without submitting and keeps the typed reason", () => {
    const { trigger, dialog } = renderDialog();
    expect(dialog.open).toBe(true);
    fireEvent.change(screen.getByRole("textbox", { name: "Reason (optional)" }), { target: { value: "Duplicate" } });

    fireEvent.click(screen.getByRole("button", { name: "Keep draft" }));

    expect(dialog.open).toBe(false);
    expect(cancelFormAction).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(trigger);
    fireEvent.click(trigger);
    expect(screen.getByRole("textbox", { name: "Reason (optional)" })).toHaveProperty("value", "Duplicate");
  });

  it("Cancel draft submits the ids, expected version and reason", async () => {
    cancelFormAction.mockResolvedValue({ ok: true, data: { prescriptionId: IDS.prescriptionId } });
    renderDialog();
    fireEvent.change(screen.getByRole("textbox", { name: "Reason (optional)" }), { target: { value: "Entered in error" } });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Cancel draft" }));
    });

    expect(cancelFormAction).toHaveBeenCalledTimes(1);
    const formData = cancelFormAction.mock.calls[0]![1];
    expect(Object.fromEntries(formData.entries())).toEqual({
      ...IDS,
      expectedVersion: "3",
      reason: "Entered in error",
    });
  });

  it("keeps the dialog open and shows the error when cancellation fails", async () => {
    cancelFormAction.mockResolvedValue({
      ok: false,
      errors: { code: "CONFLICT", formErrors: ["The draft changed since you opened it."], fieldErrors: {} },
    });
    const { dialog } = renderDialog();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Cancel draft" }));
    });

    expect(dialog.open).toBe(true);
    expect(screen.getByRole("alert").textContent).toContain("The draft changed since you opened it.");
  });
});
