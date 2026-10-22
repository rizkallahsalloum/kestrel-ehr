import { describe, expect, it } from "vitest";
import { buildQueue, orderQueue, queueStatus, type QueueDraftRow, type QueuePatient } from "./queue";

function draft(overrides: Partial<QueueDraftRow> = {}): QueueDraftRow {
  return { status: "draft", version: 2, last_evaluated_version: 2, prescription_alerts: [], ...overrides };
}

const blocking = { prescription_version: 2, severity: "blocking" as const, decision: null };
const advisory = { prescription_version: 2, severity: "advisory" as const, decision: null };

describe("queueStatus", () => {
  it("is stable without drafts or alerts", () => {
    expect(queueStatus([])).toBe("stable");
    expect(queueStatus([draft()])).toBe("stable");
  });

  it("is critical when a checked draft has a blocking alert on its current version", () => {
    expect(queueStatus([draft({ prescription_alerts: [advisory, blocking] })])).toBe("critical");
  });

  it("is warning when an advisory alert is not acknowledged", () => {
    expect(queueStatus([draft({ prescription_alerts: [advisory] })])).toBe("warning");
  });

  it("ignores acknowledged advisories", () => {
    expect(queueStatus([draft({ prescription_alerts: [{ ...advisory, decision: { id: "d1" } }] })])).toBe("stable");
  });

  it("ignores alerts on an older version and drafts whose current version was not checked", () => {
    expect(queueStatus([draft({ prescription_alerts: [{ ...blocking, prescription_version: 1 }] })])).toBe("stable");
    expect(queueStatus([draft({ last_evaluated_version: 1, prescription_alerts: [blocking] })])).toBe("stable");
  });

  it("ignores prescriptions that are no longer drafts", () => {
    expect(queueStatus([draft({ status: "signed", prescription_alerts: [blocking] })])).toBe("stable");
  });

  it("takes the most severe state across drafts", () => {
    expect(queueStatus([draft({ prescription_alerts: [advisory] }), draft({ prescription_alerts: [blocking] })])).toBe(
      "critical",
    );
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
});
