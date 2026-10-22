import { describe, expect, it } from "vitest";
import { buildQueue, orderQueue, queueItemCount, queueStatus, type QueueDraftRow, type QueuePatient } from "./queue";

function draft(overrides: Partial<QueueDraftRow> = {}): QueueDraftRow {
  return { status: "draft", version: 2, last_evaluated_version: 2, prescription_alerts: [], ...overrides };
}

const blocking = { prescription_version: 2, severity: "blocking" as const, decision: null };
const advisory = { prescription_version: 2, severity: "advisory" as const, decision: null };

describe("queueStatus", () => {
  const status = (...drafts: QueueDraftRow[]) => queueStatus({ drafts });

  it("is stable without drafts, or with checked drafts that have no open alerts", () => {
    expect(status()).toBe("stable");
    expect(status(draft())).toBe("stable");
  });

  it("is critical when a checked draft has an unresolved blocking alert on its current version", () => {
    expect(status(draft({ prescription_alerts: [advisory, blocking] }))).toBe("critical");
  });

  it("is warning when an advisory alert on the current version has no decision", () => {
    expect(status(draft({ prescription_alerts: [advisory] }))).toBe("warning");
  });

  it("is warning when the saved version has not been safety-checked", () => {
    expect(status(draft({ last_evaluated_version: null }))).toBe("warning");
    expect(status(draft({ last_evaluated_version: 1 }))).toBe("warning");
    // A blocking alert from the earlier check belongs to an older version: not critical, still unchecked.
    expect(status(draft({ last_evaluated_version: 1, prescription_alerts: [{ ...blocking, prescription_version: 1 }] }))).toBe(
      "warning",
    );
  });

  it("ignores acknowledged advisories and alerts on an older version", () => {
    expect(status(draft({ prescription_alerts: [{ ...advisory, decision: { id: "d1" } }] }))).toBe("stable");
    expect(status(draft({ prescription_alerts: [{ ...blocking, prescription_version: 1 }] }))).toBe("stable");
  });

  it("ignores prescriptions that are no longer drafts, checked or not", () => {
    expect(status(draft({ status: "signed", prescription_alerts: [blocking] }))).toBe("stable");
    expect(status(draft({ status: "cancelled", last_evaluated_version: null }))).toBe("stable");
  });

  it("takes the most severe state across drafts, in any order", () => {
    expect(status(draft({ prescription_alerts: [advisory] }), draft({ prescription_alerts: [blocking] }))).toBe("critical");
    expect(status(draft({ last_evaluated_version: null }), draft({ prescription_alerts: [blocking] }))).toBe("critical");
    expect(status(draft({ prescription_alerts: [blocking] }), draft({ last_evaluated_version: null }))).toBe("critical");
    expect(status(draft(), draft({ last_evaluated_version: null }))).toBe("warning");
  });
});

describe("queueItemCount", () => {
  const patients = (n: number): QueuePatient[] =>
    Array.from({ length: n }, (_, i) => ({ id: `${i}`, givenName: "A", familyName: "B", status: "stable" }));

  it("counts chips, plus View all beyond six, and one item for an unavailable queue", () => {
    expect(queueItemCount([])).toBe(0);
    expect(queueItemCount(patients(1))).toBe(1);
    expect(queueItemCount(patients(6))).toBe(6);
    expect(queueItemCount(patients(7))).toBe(7);
    expect(queueItemCount(patients(30))).toBe(7);
    expect(queueItemCount(null)).toBe(1);
  });
});
describe("orderQueue", () => {
  const p = (id: string, familyName: string, givenName: string, status: QueuePatient["status"]): QueuePatient => ({
    id,
    familyName,
    givenName,
    status,
  });

  it("orders by severity, then family name, then given name", () => {
    const ordered = orderQueue([
      p("1", "Zeta", "Ann", "stable"),
      p("2", "Alpha", "Bea", "warning"),
      p("3", "Beta", "Cal", "critical"),
      p("4", "Alpha", "Abe", "warning"),
      p("5", "alpha", "Dee", "stable"),
    ]);
    expect(ordered.map((x) => x.id)).toEqual(["3", "4", "2", "5", "1"]);
  });

  it("does not change the input", () => {
    const input = [p("1", "B", "B", "stable"), p("2", "A", "A", "stable")];
    orderQueue(input);
    expect(input.map((x) => x.id)).toEqual(["1", "2"]);
  });
});

describe("buildQueue", () => {
  it("maps rows and orders them", () => {
    const queue = buildQueue([
      { id: "a", given_name: "Rowan", family_name: "Testcase", prescriptions: [] },
      { id: "b", given_name: "Mira", family_name: "Demoson", prescriptions: [draft({ prescription_alerts: [blocking] })] },
    ]);
    expect(queue).toEqual([
      { id: "b", givenName: "Mira", familyName: "Demoson", status: "critical" },
      { id: "a", givenName: "Rowan", familyName: "Testcase", status: "stable" },
    ]);
  });

  it("uses all three statuses by case", () => {
    const queue = buildQueue([
      { id: "s", given_name: "Sam", family_name: "Stable", prescriptions: [draft()] },
      { id: "u", given_name: "Una", family_name: "Unchecked", prescriptions: [draft({ last_evaluated_version: 1 })] },
      { id: "b", given_name: "Bo", family_name: "Blocked", prescriptions: [draft({ prescription_alerts: [blocking] })] },
    ]);
    expect(queue.map((p) => [p.id, p.status])).toEqual([
      ["b", "critical"],
      ["u", "warning"],
      ["s", "stable"],
    ]);
  });
});
