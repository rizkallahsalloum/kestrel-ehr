import { describe, expect, it } from "vitest";
import { newDraftValues } from "./form-values";
import { todayUtc } from "./schemas";
import { getSignReadiness } from "./transitions";
import { countAlerts, isDirty, orderAlerts, safetyState, signButtonLabel, trackerSteps } from "./workspace";

const MED = "3e000000-0000-4000-8000-000000000002";
const decision = { id: "d", reason: null, created_at: "2026-10-19T08:00:00Z" };

describe("safetyState", () => {
  it("separates unsaved, unchecked and checked versions", () => {
    expect(safetyState(null, [])).toEqual({ kind: "unsaved" });
    expect(safetyState({ version: 2, last_evaluated_version: 1 }, [])).toEqual({ kind: "unchecked" });
    expect(
      safetyState({ version: 2, last_evaluated_version: 2 }, [
        { severity: "blocking", decision: null },
        { severity: "advisory", decision: null },
        { severity: "advisory", decision },
      ]),
    ).toEqual({ kind: "checked", blocking: 1, advisoryPending: 1, acknowledged: 1 });
  });
});

describe("orderAlerts", () => {
  it("lists blocking, then advisories to acknowledge, then acknowledged ones", () => {
    const alerts = [
      { id: "ack", severity: "advisory" as const, decision },
      { id: "adv1", severity: "advisory" as const, decision: null },
      { id: "blk", severity: "blocking" as const, decision: null },
      { id: "adv2", severity: "advisory" as const, decision: null },
    ];
    expect(orderAlerts(alerts).map((a) => a.id)).toEqual(["blk", "adv1", "adv2", "ack"]);
  });
});

describe("isDirty", () => {
  it("compares every field with the saved values", () => {
    const saved = newDraftValues("2026-10-19");
    expect(isDirty({ ...saved }, saved)).toBe(false);
    expect(isDirty({ ...saved, quantity: "30" }, saved)).toBe(true);
  });
});

describe("trackerSteps", () => {
  const complete = { ...newDraftValues(todayUtc()), medicationId: MED, doseAmount: "1", quantity: "28" };

  it("marks medication, directions and review from the form state", () => {
    expect(trackerSteps(complete, [MED], true).map((s) => s.done)).toEqual([true, true, true]);
    expect(trackerSteps(newDraftValues(todayUtc()), [MED], false).map((s) => s.done)).toEqual([false, false, false]);
  });

  it("uses the shared schema for the directions and supply step", () => {
    expect(trackerSteps({ ...complete, quantity: "1.5" }, [MED], true)[1]!.done).toBe(false);
    expect(trackerSteps({ ...complete, refills: "6" }, [MED], true)[1]!.done).toBe(false);
    expect(trackerSteps({ ...complete, startDate: "2000-01-01" }, [MED], true)[1]!.done).toBe(false);
  });

  it("does not count a medication outside the active catalog", () => {
    expect(trackerSteps(complete, [], true)[0]!.done).toBe(false);
  });
});

describe("signButtonLabel", () => {
  const ready = getSignReadiness({ status: "draft", version: 1, lastEvaluatedVersion: 1, alerts: [] });
  const clear = countAlerts([]);
  const label = (overrides: Partial<Parameters<typeof signButtonLabel>[0]>) =>
    signButtonLabel({ readiness: ready, counts: clear, evaluated: true, dirty: false, attested: true, ...overrides });

  it("names the first missing step, in order", () => {
    expect(label({ dirty: true, evaluated: false })).toBe("Save your changes to sign");
    expect(label({ evaluated: false })).toBe("Run the safety check to sign");
    expect(label({ counts: { blocking: 1, advisoryPending: 1, acknowledged: 0 } })).toBe(
      "Blocking alert: change or cancel the draft",
    );
    expect(label({ counts: { blocking: 0, advisoryPending: 2, acknowledged: 0 } })).toBe(
      "Acknowledge 2 advisory alerts to sign",
    );
    expect(label({ attested: false })).toBe("Confirm the review to sign");
  });

  it("ends with the simulated signing action", () => {
    expect(label({})).toBe("Sign prescription (simulated)");
  });
});
