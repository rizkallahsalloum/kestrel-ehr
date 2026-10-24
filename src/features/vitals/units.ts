import type { VitalKind } from "./thresholds";

/** Units are words ("bpm", "mmHg") or symbols ("%", "°F"); a space goes before words only. */
export const VITAL_UNIT: Record<VitalKind, { unit: string; spaced: boolean }> = {
  heart_rate: { unit: "bpm", spaced: true },
  blood_pressure: { unit: "mmHg", spaced: true },
  spo2: { unit: "%", spaced: false },
  temperature: { unit: "°F", spaced: false },
};

/** What goes between a vital's value and its unit: "108 bpm", "148/92 mmHg", "91%", "98.4°F". */
export function unitSeparator(kind: VitalKind): "" | " " {
  return VITAL_UNIT[kind].spaced ? " " : "";
}

export function withUnit(kind: VitalKind, value: string): string {
  return `${value}${unitSeparator(kind)}${VITAL_UNIT[kind].unit}`;
}
