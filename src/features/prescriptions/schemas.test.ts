import { describe, expect, it } from "vitest";
import {
  acknowledgeAlertSchema,
  createDraftSchema,
  isStartDateInWindow,
  prescriptionContentSchema,
  signSchema,
  toPrescriptionColumns,
  todayUtc,
} from "./schemas";

const MED = "3e000000-0000-4000-8000-000000000002";
const PATIENT = "9a000000-0000-4000-8000-000000000001";
const RX = "4f000000-0000-4000-8000-000000000001";

function validForm(overrides: Record<string, unknown> = {}) {
  return {
    medicationId: MED,
    doseAmount: "250",
    doseUnit: "mg",
    route: "oral",
    frequency: "twice_daily",
    quantity: "20",
    refills: "0",
    durationDays: "",
    startDate: todayUtc(),
    instructions: "  Take with water (synthetic)  ",
    ...overrides,
  };
}

function fieldErrors(input: Record<string, unknown>) {
  const result = prescriptionContentSchema.safeParse(input);
  if (result.success) return {};
  return Object.fromEntries(result.error.issues.map((i) => [i.path.join("."), i.message]));
}

describe("prescriptionContentSchema", () => {
  it("coerces form strings and trims text", () => {
    const parsed = prescriptionContentSchema.parse(validForm());
    expect(parsed).toMatchObject({ doseAmount: 250, quantity: 20, refills: 0, instructions: "Take with water (synthetic)" });
    expect(parsed.durationDays).toBeUndefined();
  });

  it.each([
    ["0", "Quantity must be at least 1."],
    ["-3", "Quantity must be at least 1."],
    ["2.5", "Quantity must be a whole number."],
    ["1001", "Quantity cannot exceed 1000."],
    ["abc", "Enter a quantity."],
  ])("rejects quantity %s", (quantity, message) => {
    expect(fieldErrors(validForm({ quantity })).quantity).toBe(message);
  });

  it("requires a positive dose with at most three decimals", () => {
    expect(fieldErrors(validForm({ doseAmount: "0" })).doseAmount).toBeDefined();
    expect(fieldErrors(validForm({ doseAmount: "1.2345" })).doseAmount).toBe("Use at most three decimal places.");
    expect(fieldErrors(validForm({ doseAmount: "1.125" })).doseAmount).toBeUndefined();
  });

  it("only permits enumerated units, routes and frequencies", () => {
    expect(fieldErrors(validForm({ doseUnit: "drops" })).doseUnit).toBe("Choose a dose unit.");
    expect(fieldErrors(validForm({ route: "intravenous" })).route).toBe("Choose a route.");
    expect(fieldErrors(validForm({ frequency: "hourly" })).frequency).toBe("Choose a frequency.");
  });

  it("limits refills to 0-5 and treats blank as 0", () => {
    expect(prescriptionContentSchema.parse(validForm({ refills: "" })).refills).toBe(0);
    expect(fieldErrors(validForm({ refills: "6" })).refills).toBe("At most 5 refills are allowed.");
  });

  it("enforces the start date window", () => {
    const now = new Date("2026-10-19T10:00:00Z");
    expect(isStartDateInWindow("2026-11-18", now)).toBe(true);
    expect(isStartDateInWindow("2026-11-19", now)).toBe(false);
    expect(isStartDateInWindow("2026-09-19", now)).toBe(true);
    expect(isStartDateInWindow("2026-09-18", now)).toBe(false);
    expect(fieldErrors(validForm({ startDate: "2020-01-01" })).startDate).toBe(
      "Start date must be within 30 days of today.",
    );
    expect(fieldErrors(validForm({ startDate: "2026-02-30" })).startDate).toBeDefined();
  });

  it("limits instructions to 500 characters", () => {
    expect(fieldErrors(validForm({ instructions: "x".repeat(501) })).instructions).toBeDefined();
  });

  it("maps to writable columns only", () => {
    const columns = toPrescriptionColumns(prescriptionContentSchema.parse(validForm()));
    expect(Object.keys(columns).sort()).toEqual(
      [
        "dose_amount",
        "dose_unit",
        "duration_days",
        "frequency",
        "instructions",
        "medication_id",
        "quantity",
        "refills",
        "route",
        "start_date",
      ].sort(),
    );
  });
});

describe("workflow schemas", () => {
  it("requires an idempotency key for drafts", () => {
    expect(createDraftSchema.safeParse({ ...validForm(), patientId: PATIENT }).success).toBe(false);
    expect(
      createDraftSchema.safeParse({ ...validForm(), patientId: PATIENT, idempotencyKey: crypto.randomUUID() }).success,
    ).toBe(true);
  });

  it("requires explicit attestation to sign", () => {
    const base = { patientId: PATIENT, prescriptionId: RX, expectedVersion: "2" };
    expect(signSchema.safeParse(base).success).toBe(false);
    expect(signSchema.safeParse({ ...base, attestation: "on" }).success).toBe(true);
  });

  it("bounds acknowledgement reasons", () => {
    const base = { patientId: PATIENT, prescriptionId: RX, alertId: RX };
    expect(acknowledgeAlertSchema.parse({ ...base, reason: "" }).reason).toBeUndefined();
    expect(acknowledgeAlertSchema.safeParse({ ...base, reason: "x".repeat(301) }).success).toBe(false);
  });
});
