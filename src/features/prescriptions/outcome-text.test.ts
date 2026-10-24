import { describe, expect, it, vi } from "vitest";
import { OUTCOME_TOAST, withOutcomeToast } from "./outcome-text";
describe("OUTCOME_TOAST", () => {
  it("has short fixed text with no digits or record details", () => {
    for (const text of Object.values(OUTCOME_TOAST)) {
      expect(text).toMatch(/^[A-Z][a-z ()]+\.$/);
    }
  });
});

describe("withOutcomeToast", () => {
  it("shows the mapped text on success and nothing on failure", async () => {
    const notify = vi.fn();
    const ok = withOutcomeToast(async () => ({ ok: true, data: { prescriptionId: "x", outcome: "prescription-signed" } }), notify);
    await ok(null, new FormData());
    expect(notify).toHaveBeenCalledWith("Prescription signed (simulated).");

    notify.mockClear();
    const failed = withOutcomeToast<{ prescriptionId: string }>(
      async () => ({ ok: false, errors: { code: "CONFLICT", formErrors: ["Changed."], fieldErrors: {} } }),
      notify,
    );
    const result = await failed(null, new FormData());
    expect(result?.ok).toBe(false);
    expect(notify).not.toHaveBeenCalled();
  });
});
