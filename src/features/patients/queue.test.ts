import { describe, expect, it } from "vitest";
import type { VitalReading } from "@/features/vitals/thresholds";
import {
  buildQueue,
  orderQueue,
  QUEUE_AVATAR_TONES,
  queueAvatarTones,
  queueItemCount,
  queueStatus,
  type QueueAllergyRow,
  type QueueDraftRow,
  type QueuePatient,
  type QueuePatientRow,
} from "./queue";

function draft(overrides: Partial<QueueDraftRow> = {}): QueueDraftRow {
  return { status: "draft", version: 2, last_evaluated_version: 2, prescription_alerts: [], ...overrides };
}

const blocking = { prescription_version: 2, severity: "blocking" as const, decision: null };
const advisory = { prescription_version: 2, severity: "advisory" as const, decision: null };

describe("queueStatus", () => {
  const status = (...drafts: QueueDraftRow[]) => queueStatus({ drafts, allergies: [] });
  const withAllergies = (severities: QueueAllergyRow["severity"][], ...drafts: QueueDraftRow[]) =>
    queueStatus({ drafts, allergies: severities.map((severity) => ({ severity })) });

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

  it("is critical for an active severe allergy, with or without drafts", () => {
    expect(withAllergies(["severe"])).toBe("critical");
    expect(withAllergies(["mild", "severe"], draft())).toBe("critical");
    expect(withAllergies(["severe"], draft({ prescription_alerts: [advisory] }))).toBe("critical");
  });

  it("is warning for an active moderate allergy, unless a draft makes it critical", () => {
    expect(withAllergies(["moderate"])).toBe("warning");
    expect(withAllergies(["mild", "moderate"], draft())).toBe("warning");
    expect(withAllergies(["moderate"], draft({ prescription_alerts: [blocking] }))).toBe("critical");
  });

  it("stays stable for mild allergies alone", () => {
    expect(withAllergies(["mild"])).toBe("stable");
    expect(withAllergies(["mild", "mild"], draft())).toBe("stable");
    expect(withAllergies(["mild"], draft({ last_evaluated_version: 1 }))).toBe("warning");
  });

  const reading = (overrides: Partial<VitalReading> = {}): VitalReading => ({
    recorded_at: "2026-10-12T09:00:00Z",
    heart_rate: 72,
    systolic: 118,
    diastolic: 76,
    spo2: 98,
    temperature_f: 98.4,
    ...overrides,
  });
  const withVitals = (vitals: VitalReading | null, severities: QueueAllergyRow["severity"][] = [], ...drafts: QueueDraftRow[]) =>
    queueStatus({ drafts, allergies: severities.map((severity) => ({ severity })), vitals });

  it("follows the latest vitals reading under the DEMO vitals rules", () => {
    expect(withVitals(null)).toBe("stable");
    expect(withVitals(reading())).toBe("stable");
    expect(withVitals(reading({ systolic: 148, diastolic: 92 }))).toBe("warning");
    expect(withVitals(reading({ spo2: 91 }))).toBe("critical");
  });

  it("takes the most severe of vitals, allergies and drafts", () => {
    expect(withVitals(reading({ spo2: 91 }), ["mild"], draft({ prescription_alerts: [advisory] }))).toBe("critical");
    expect(withVitals(reading({ heart_rate: 108 }), ["severe"])).toBe("critical");
    expect(withVitals(reading(), ["moderate"])).toBe("warning");
    expect(withVitals(reading({ heart_rate: 108 }), [], draft({ prescription_alerts: [blocking] }))).toBe("critical");
  });
});

describe("queueItemCount", () => {
  const patients = (n: number): QueuePatient[] =>
    Array.from({ length: n }, (_, i) => ({ id: `${i}`, ref: `${i}`, givenName: "A", familyName: "B", status: "stable" }));

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
    ref: id,
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
  const row = (id: string, given_name: string, family_name: string, signals: Partial<QueuePatientRow> = {}): QueuePatientRow => ({
    id,
    public_ref: `ref-${id}`,
    given_name,
    family_name,
    prescriptions: [],
    allergies: [],
    ...signals,
  });

  it("maps rows and orders them", () => {
    const queue = buildQueue([
      row("a", "Rowan", "Testcase"),
      row("b", "Mira", "Demoson", { prescriptions: [draft({ prescription_alerts: [blocking] })] }),
    ]);
    expect(queue).toEqual([
      { id: "b", ref: "ref-b", givenName: "Mira", familyName: "Demoson", status: "critical" },
      { id: "a", ref: "ref-a", givenName: "Rowan", familyName: "Testcase", status: "stable" },
    ]);
  });

  it("uses all three statuses by case", () => {
    const queue = buildQueue([
      row("s", "Sam", "Stable", { prescriptions: [draft()] }),
      row("u", "Una", "Unchecked", { prescriptions: [draft({ last_evaluated_version: 1 })] }),
      row("b", "Bo", "Blocked", { prescriptions: [draft({ prescription_alerts: [blocking] })] }),
    ]);
    expect(queue.map((p) => [p.id, p.status])).toEqual([
      ["b", "critical"],
      ["u", "warning"],
      ["s", "stable"],
    ]);
  });

  it("uses allergy severities from the same rows", () => {
    const queue = buildQueue([
      row("m", "Mo", "Mild", { allergies: [{ severity: "mild" }] }),
      row("o", "Oz", "Moderate", { allergies: [{ severity: "moderate" }] }),
      row("v", "Vi", "Severe", { allergies: [{ severity: "severe" }] }),
    ]);
    expect(queue.map((p) => [p.id, p.status])).toEqual([
      ["v", "critical"],
      ["o", "warning"],
      ["m", "stable"],
    ]);
  });

  it("uses the first embedded vitals reading (the query returns only the latest)", () => {
    const base = { recorded_at: "2026-10-12T09:00:00Z", heart_rate: 72, systolic: 118, diastolic: 76, temperature_f: 98.4 };
    const queue = buildQueue([
      row("n", "No", "Readings", { vital_readings: [] }),
      row("c", "Cy", "Critical", { vital_readings: [{ ...base, spo2: 91 }] }),
    ]);
    expect(queue.map((p) => [p.id, p.status])).toEqual([
      ["c", "critical"],
      ["n", "stable"],
    ]);
  });
});

describe("queueAvatarTones", () => {
  const ids = (...list: string[]) => list.map((id) => ({ id }));

  it("gives a single patient the first slot (teal)", () => {
    expect(queueAvatarTones(ids("p-9"))).toEqual(new Map([["p-9", "queue-1"]]));
    expect(QUEUE_AVATAR_TONES[0]).toBe("queue-1");
  });

  it("assigns the three slots by sorted id, index mod 3", () => {
    const tones = queueAvatarTones(ids("e", "a", "d", "b", "c"));
    expect([...tones.entries()]).toEqual([
      ["a", "queue-1"],
      ["b", "queue-2"],
      ["c", "queue-3"],
      ["d", "queue-1"],
      ["e", "queue-2"],
    ]);
    expect(new Set(tones.values()).size).toBe(3);
  });

  it("is stable when the queue is reordered by status", () => {
    const patients: QueuePatient[] = [
      { id: "id-3", ref: "r3", givenName: "A", familyName: "Alpha", status: "stable" },
      { id: "id-1", ref: "r1", givenName: "B", familyName: "Bravo", status: "warning" },
      { id: "id-2", ref: "r2", givenName: "C", familyName: "Charlie", status: "critical" },
    ];
    const before = queueAvatarTones(orderQueue(patients));
    const rotated = patients.map((p, i) => ({ ...p, status: patients[(i + 1) % patients.length]!.status }));
    const after = queueAvatarTones(orderQueue(rotated));
    expect(orderQueue(rotated).map((p) => p.id)).not.toEqual(orderQueue(patients).map((p) => p.id));
    expect(after).toEqual(before);
    expect(queueAvatarTones([...patients].reverse())).toEqual(before);
  });

  it("uses the whole queue, so the colours do not depend on which six are shown", () => {
    const all = ids("g", "f", "e", "d", "c", "b", "a");
    const tones = queueAvatarTones(all);
    expect(tones.get("g")).toBe("queue-1");
    expect(tones.size).toBe(7);
  });

  it("ignores duplicate ids and an empty queue", () => {
    expect(queueAvatarTones([]).size).toBe(0);
    expect(queueAvatarTones(ids("a", "a", "b"))).toEqual(new Map([["a", "queue-1"], ["b", "queue-2"]]));
  });
});