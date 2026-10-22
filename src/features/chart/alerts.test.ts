import { describe, expect, it } from "vitest";
import type { DraftAlertRow, PrescriptionListItem } from "@/types/domain";
import {
  blockingBannerTitle,
  countUncheckedDrafts,
  draftSafetyState,
  medicationLabel,
  summarizeDraftAlerts,
  utcDay,
} from "./alerts";

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
    expect(summary[0]).toMatchObject({
      blocking: 1,
      advisoryPending: 0,
      medicationLabel: "Zentoril 10 mg tablet",
      createdAt: "2026-10-19T08:00:00Z",
    });
    expect(summary[1]).toMatchObject({ blocking: 0, advisoryPending: 1 });
  });

  it("returns nothing when there are no drafts", () => {
    expect(summarizeDraftAlerts([rx("s", { status: "signed" })], [])).toEqual([]);
  });
});

describe("blockingBannerTitle", () => {
  const TODAY = "Allergy conflict on today's order";
  const PENDING = "Allergy conflict on pending order";

  it("says today's order for a draft created earlier the same UTC day", () => {
    expect(blockingBannerTitle("2026-10-22T08:00:00Z", new Date("2026-10-22T17:30:00Z"))).toBe(TODAY);
  });

  it("says pending order for a draft created yesterday", () => {
    expect(blockingBannerTitle("2026-10-21T08:00:00Z", new Date("2026-10-22T08:00:00Z"))).toBe(PENDING);
  });

  it("switches exactly at UTC midnight", () => {
    const created = "2026-10-21T23:59:59.999Z";
    expect(blockingBannerTitle(created, new Date("2026-10-21T23:59:59.999Z"))).toBe(TODAY);
    expect(blockingBannerTitle(created, new Date("2026-10-22T00:00:00.000Z"))).toBe(PENDING);
    expect(blockingBannerTitle("2026-10-22T00:00:00.000Z", new Date("2026-10-22T23:59:59.999Z"))).toBe(TODAY);
  });

  it("compares in UTC, not in the offset the timestamp was written in", () => {
    // 01:30 on 22 Oct at UTC+3 is 22:30 on 21 Oct UTC.
    expect(utcDay("2026-10-22T01:30:00+03:00")).toBe("2026-10-21");
    expect(blockingBannerTitle("2026-10-22T01:30:00+03:00", new Date("2026-10-22T09:00:00Z"))).toBe(PENDING);
    expect(blockingBannerTitle("2026-10-22T01:30:00+03:00", new Date("2026-10-21T23:00:00Z"))).toBe(TODAY);
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
