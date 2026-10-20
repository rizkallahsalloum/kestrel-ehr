import type { DoseFrequency, DoseUnit, MedicationRoute } from "@/types/domain";

// Plain-language wording for the structured directions. Formatting only: it adds no dosing
// guidance and covers exactly the enum values the database accepts.

export const ROUTE_WORDING: Record<MedicationRoute, { verb: string; phrase: string }> = {
  oral: { verb: "Take", phrase: "by mouth" },
  topical: { verb: "Apply", phrase: "to the skin" },
  inhaled: { verb: "Inhale", phrase: "by inhalation" },
  subcutaneous: { verb: "Inject", phrase: "under the skin" },
  intramuscular: { verb: "Inject", phrase: "into the muscle" },
};

export const FREQUENCY_WORDING: Record<DoseFrequency, string> = {
  once_daily: "once daily",
  twice_daily: "twice daily",
  three_times_daily: "three times daily",
  four_times_daily: "four times daily",
  every_8_hours: "every 8 hours",
  at_bedtime: "at bedtime",
  as_needed: "as needed",
};

/** Administrations per day; null when the frequency has no fixed count. */
const DOSES_PER_DAY: Record<DoseFrequency, number | null> = {
  once_daily: 1,
  twice_daily: 2,
  three_times_daily: 3,
  four_times_daily: 4,
  every_8_hours: 3,
  at_bedtime: 1,
  as_needed: null,
};

const COUNT_UNITS: Partial<Record<DoseUnit, [string, string]>> = {
  tablet: ["tablet", "tablets"],
  capsule: ["capsule", "capsules"],
};

export type SigInput = {
  doseAmount: string | number;
  doseUnit: string;
  route: string;
  frequency: string;
};

function positiveNumber(value: string | number): number | null {
  const n = typeof value === "number" ? value : Number(value);
  return value !== "" && Number.isFinite(n) && n > 0 ? n : null;
}

function isKey<T extends object>(record: T, key: string): key is Extract<keyof T, string> {
  return Object.hasOwn(record, key);
}

function amountText(amount: number, unit: string): string {
  const words = isKey(COUNT_UNITS, unit) ? COUNT_UNITS[unit] : undefined;
  if (!words) return `${amount} ${unit}`;
  return `${amount} ${amount === 1 ? words[0] : words[1]}`;
}

/** "Take 2 tablets by mouth twice daily." or null while the dose or a choice is missing. */
export function sigSentence(input: SigInput): string | null {
  const amount = positiveNumber(input.doseAmount);
  if (amount === null || !isKey(ROUTE_WORDING, input.route) || !isKey(FREQUENCY_WORDING, input.frequency)) {
    return null;
  }
  const route = ROUTE_WORDING[input.route];
  return `${route.verb} ${amountText(amount, input.doseUnit)} ${route.phrase} ${FREQUENCY_WORDING[input.frequency]}.`;
}

/**
 * Days a quantity lasts, for the duration hint (D9). Only for tablet and capsule doses with a fixed
 * frequency; anything else would need the catalog strength, which is display text.
 */
export function calculatedDays(input: SigInput & { quantity: string | number }): number | null {
  const amount = positiveNumber(input.doseAmount);
  const quantity = positiveNumber(input.quantity);
  if (amount === null || quantity === null || !isKey(COUNT_UNITS, input.doseUnit)) return null;
  const perDay = isKey(DOSES_PER_DAY, input.frequency) ? DOSES_PER_DAY[input.frequency] : null;
  if (!perDay) return null;
  const days = Math.floor(quantity / (amount * perDay));
  return days >= 1 ? days : null;
}

export type LabelInput = SigInput & {
  patientName: string;
  medication: string;
  quantity: string | number;
  refills: string | number;
  instructions?: string | null;
};

/** Lines of the simulated patient label (client-only preview). */
export function labelLines(input: LabelInput): string[] {
  const lines = [input.patientName, input.medication, sigSentence(input) ?? "Directions incomplete"];
  if (input.instructions?.trim()) lines.push(input.instructions.trim());
  lines.push(`Qty ${input.quantity}, refills ${input.refills}`);
  lines.push("Simulated label. Synthetic data, not dispensed.");
  return lines;
}
