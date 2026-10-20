import { describe, expect, it } from "vitest";
import type { DraftAlertRow, PrescriptionListItem } from "@/types/domain";
import { countUncheckedDrafts, draftSafetyState, medicationLabel, summarizeDraftAlerts } from "./alerts";

function rx(id: string, overrides: Partial<PrescriptionListItem> = {}): PrescriptionListItem {
  return {
    id,
    status: "draft",
    version: 2,
    last_evaluated_version: 2,
    quantity: 30,
    start_date: "2026-10-19",
    created_at: "2026-10-19T08:00:00Z",
    signed_at: null,
    prescriber_id: "a0000000-0000-4000-8000-000000000001",
    medication: { name: "Zentoril", strength: "10 mg", form: "tablet" },
    ...overrides,
  };
}

function alert(id: string, prescriptionId: string, overrides: Partial<DraftAlertRow> = {}): DraftAlertRow {
  return {
    id,
    prescription_id: prescriptionId,
    prescription_version: 2,
    severity: "advisory",
    message: `DEMO RULE ${id}`,
    decision: null,
    ...overrides,
  };
}

describe("draftSafetyState", () => {
  it("ignores prescriptions that are not drafts", () => {
    expect(draftSafetyState(rx("a", { status: "signed" }), [alert("1", "a")])).toBeNull();
    expect(draftSafetyState(rx("a", { status: "cancelled" }), [alert("1", "a")])).toBeNull();
  });

  it("reports a draft whose saved version was never evaluated as unchecked, even with old alerts", () => {
    const draft = rx("a", { version: 3, last_evaluated_version: 2 });
    expect(draftSafetyState(draft, [alert("1", "a", { severity: "blocking" })])).toEqual({ kind: "unchecked" });
    expect(draftSafetyState(rx("b", { last_evaluated_version: null }), [])).toEqual({ kind: "unchecked" });
  });

  it("counts only alerts on the current version and treats acknowledged advisories as done", () => {
    const state = draftSafetyState(rx("a"), [
      alert("old", "a", { prescription_version: 1, severity: "blocking" }),
      alert("other", "b", { severity: "blocking" }),
      alert("ack", "a", { decision: { id: "d1" } }),
      alert("adv", "a"),
      alert("blk", "a", { severity: "blocking" }),
    ]);
    expect(state).toEqual({
      kind: "checked",
      blocking: 1,
      advisoryPending: 1,
      messages: ["DEMO RULE blk", "DEMO RULE adv"],
    });
  });
});

describe("summarizeDraftAlerts", () => {
  it("lists only drafts that still need action, blocking drafts first", () => {
    const prescriptions = [
      rx("advisory"),
      rx("blocking"),
      rx("clear"),
      rx("acknowledged"),
      rx("unchecked", { last_evaluated_version: null }),
      rx("signed", { status: "signed" }),
    ];
    const alerts = [
      alert("1", "advisory"),
      alert("2", "blocking", { severity: "blocking" }),
      alert("3", "acknowledged", { decision: { id: "d" } }),
      alert("4", "signed", { severity: "blocking" }),
    ];
    const summary = summarizeDraftAlerts(prescriptions, alerts);
    expect(summary.map((s) => s.prescriptionId)).toEqual(["blocking", "advisory"]);
    expect(summary[0]).toMatchObject({ blocking: 1, advisoryPending: 0, medicationLabel: "Zentoril 10 mg tablet" });
    expect(summary[1]).toMatchObject({ blocking: 0, advisoryPending: 1 });
  });

  it("returns nothing when there are no drafts", () => {
    expect(summarizeDraftAlerts([rx("s", { status: "signed" })], [])).toEqual([]);
  });
});

describe("helpers", () => {
  it("counts unchecked drafts", () => {
    expect(countUncheckedDrafts([rx("a"), rx("b", { last_evaluated_version: 1 }), rx("c", { status: "cancelled", last_evaluated_version: null })])).toBe(1);
  });

  it("labels a prescription without a medication", () => {
    expect(medicationLabel({ medication: null })).toBe("Unknown medication");
  });
});
