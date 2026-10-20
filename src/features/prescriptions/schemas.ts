import { z } from "zod";
import type { DoseFrequency, DoseUnit, MedicationRoute } from "@/types/domain";

export const DOSE_UNITS = ["mg", "mcg", "g", "mL", "tablet", "capsule"] as const satisfies readonly DoseUnit[];
export const ROUTES = [
  "oral",
  "topical",
  "inhaled",
  "subcutaneous",
  "intramuscular",
] as const satisfies readonly MedicationRoute[];
export const FREQUENCIES = [
  "once_daily",
  "twice_daily",
  "three_times_daily",
  "four_times_daily",
  "every_8_hours",
  "at_bedtime",
  "as_needed",
] as const satisfies readonly DoseFrequency[];

/** Mirrors the database trigger (current_date +/- 30 days, UTC). */
export const START_DATE_WINDOW_DAYS = 30;
const DAY_MS = 86_400_000;

export function todayUtc(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function isStartDateInWindow(date: string, now: Date = new Date()): boolean {
  const day = Date.parse(`${date}T00:00:00Z`);
  const today = Date.parse(`${todayUtc(now)}T00:00:00Z`);
  if (Number.isNaN(day)) return false;
  return Math.abs(day - today) <= START_DATE_WINDOW_DAYS * DAY_MS;
}

const blankToUndefined = (value: unknown) => (value === "" || value === null ? undefined : value);

function optionalText(max: number, label: string) {
  return z.preprocess(
    (value) => (typeof value === "string" ? value.trim() || undefined : blankToUndefined(value)),
    z.string().max(max, `${label} must be ${max} characters or fewer.`).optional(),
  );
}

const hasAtMostThreeDecimals = (value: number) => Math.abs(value * 1000 - Math.round(value * 1000)) < 1e-6;

export const prescriptionContentSchema = z.object({
  medicationId: z.uuid("Choose a medication."),
  doseAmount: z.coerce
    .number({ error: "Enter a dose amount." })
    .positive("Dose must be greater than zero.")
    .max(10_000, "Dose is too large.")
    .refine(hasAtMostThreeDecimals, "Use at most three decimal places."),
  doseUnit: z.enum(DOSE_UNITS, { error: "Choose a dose unit." }),
  route: z.enum(ROUTES, { error: "Choose a route." }),
  frequency: z.enum(FREQUENCIES, { error: "Choose a frequency." }),
  quantity: z.coerce
    .number({ error: "Enter a quantity." })
    .int("Quantity must be a whole number.")
    .positive("Quantity must be at least 1.")
    .max(1000, "Quantity cannot exceed 1000."),
  refills: z.preprocess(
    (value) => blankToUndefined(value) ?? 0,
    z.coerce
      .number({ error: "Enter the number of refills." })
      .int("Refills must be a whole number.")
      .min(0, "Refills cannot be negative.")
      .max(5, "At most 5 refills are allowed."),
  ),
  durationDays: z.preprocess(
    blankToUndefined,
    z.coerce
      .number({ error: "Enter a duration in days." })
      .int("Duration must be a whole number of days.")
      .min(1, "Duration must be at least 1 day.")
      .max(365, "Duration cannot exceed 365 days.")
      .optional(),
  ),
  startDate: z.iso
    .date("Enter a valid start date.")
    .refine((date) => isStartDateInWindow(date), "Start date must be within 30 days of today."),
  instructions: optionalText(500, "Instructions"),
});

export type PrescriptionContent = z.infer<typeof prescriptionContentSchema>;

const patientId = z.uuid("Invalid patient.");
const prescriptionId = z.uuid("Invalid prescription.");
const expectedVersion = z.coerce.number().int().positive("Invalid version.");

export const createDraftSchema = prescriptionContentSchema.extend({
  patientId,
  idempotencyKey: z.uuid("Invalid submission key. Reload the form."),
});

export const updateDraftSchema = prescriptionContentSchema.extend({
  patientId,
  prescriptionId,
  expectedVersion,
});

export const evaluateSchema = z.object({ patientId, prescriptionId });

export const acknowledgeAlertSchema = z.object({
  patientId,
  prescriptionId,
  alertId: z.uuid("Invalid alert."),
  reason: optionalText(300, "Reason"),
});

export const signSchema = z.object({
  patientId,
  prescriptionId,
  expectedVersion,
  attestation: z.literal("on", { error: "Confirm that you reviewed the prescription and its alerts." }),
});

export const cancelSchema = z.object({
  patientId,
  prescriptionId,
  expectedVersion,
  reason: optionalText(200, "Reason"),
});

export const evaluationResultSchema = z.object({
  version: z.number().int(),
  blocking: z.number().int(),
  advisoryPending: z.number().int(),
  advisoryTotal: z.number().int(),
});

export type EvaluationResult = z.infer<typeof evaluationResultSchema>;

/** Maps validated form content onto the columns the user is allowed to write. */
export function toPrescriptionColumns(content: PrescriptionContent) {
  return {
    medication_id: content.medicationId,
    dose_amount: content.doseAmount,
    dose_unit: content.doseUnit,
    route: content.route,
    frequency: content.frequency,
    quantity: content.quantity,
    refills: content.refills,
    duration_days: content.durationDays ?? null,
    start_date: content.startDate,
    instructions: content.instructions ?? null,
  };
}
