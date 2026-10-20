import { describe, expect, it } from "vitest";
import { canTransition, getSignReadiness, isEditable, PRESCRIPTION_TRANSITIONS } from "./transitions";

describe("prescription transitions", () => {
  it("only allows draft to signed or cancelled", () => {
    expect(canTransition("draft", "signed")).toBe(true);
    expect(canTransition("draft", "cancelled")).toBe(true);
    for (const from of ["signed", "cancelled"] as const) {
      for (const to of ["draft", "signed", "cancelled"] as const) {
        expect(canTransition(from, to)).toBe(false);
      }
    }
    expect(canTransition("draft", "draft")).toBe(false);
  });

  it("treats signed and cancelled as terminal and immutable", () => {
    expect(PRESCRIPTION_TRANSITIONS.signed).toEqual([]);
    expect(isEditable("signed")).toBe(false);
    expect(isEditable("cancelled")).toBe(false);
    expect(isEditable("draft")).toBe(true);
  });
});

describe("getSignReadiness", () => {
  const base = { status: "draft" as const, version: 2, lastEvaluatedVersion: 2, alerts: [] };

  it("is ready when evaluated with no open alerts", () => {
    expect(getSignReadiness(base)).toEqual({ canSign: true, reasons: [] });
  });

  it("requires evaluation of the current version", () => {
    expect(getSignReadiness({ ...base, lastEvaluatedVersion: 1 }).canSign).toBe(false);
    expect(getSignReadiness({ ...base, lastEvaluatedVersion: null }).canSign).toBe(false);
  });

  it("blocks on blocking alerts even if marked acknowledged", () => {
    const result = getSignReadiness({ ...base, alerts: [{ severity: "blocking", acknowledged: true }] });
    expect(result.canSign).toBe(false);
    expect(result.reasons[0]).toMatch(/blocking/);
  });

  it("requires every advisory alert to be acknowledged", () => {
    expect(
      getSignReadiness({ ...base, alerts: [{ severity: "advisory", acknowledged: false }] }).canSign,
    ).toBe(false);
    expect(getSignReadiness({ ...base, alerts: [{ severity: "advisory", acknowledged: true }] }).canSign).toBe(true);
  });

  it("refuses non-draft prescriptions", () => {
    expect(getSignReadiness({ ...base, status: "signed" }).canSign).toBe(false);
  });
});
