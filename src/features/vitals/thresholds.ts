/**
 * DEMO vitals status rules. Every band below is an illustrative demo value
 * chosen for the synthetic seed, not clinical guidance, and must never be read
 * as a safe or unsafe range for a real person.
 */

export type VitalStatus = "stable" | "warning" | "critical";
export type VitalKind = "heart_rate" | "blood_pressure" | "spo2" | "temperature";

export type VitalReading = {
  recorded_at: string;
  heart_rate: number;
  systolic: number;
  diastolic: number;
  spo2: number;
  temperature_f: number;
};

export type VitalRule = { code: string; vital: VitalKind; status: Exclude<VitalStatus, "stable">; text: string };

export const VITAL_RULES: readonly VitalRule[] = [
  {
    code: "DEMO-V001",
    vital: "heart_rate",
    status: "critical",
    text: "DEMO RULE: heart rate below 40 or above 120 bpm shows Critical. Illustrative only, not clinical guidance.",
  },
  {
    code: "DEMO-V002",
    vital: "heart_rate",
    status: "warning",
    text: "DEMO RULE: heart rate 40–49 or 101–120 bpm shows Warning. Illustrative only, not clinical guidance.",
  },
  {
    code: "DEMO-V003",
    vital: "blood_pressure",
    status: "critical",
    text: "DEMO RULE: systolic 180 or above or below 80, or diastolic 120 or above, shows Critical. Illustrative only, not clinical guidance.",
  },
  {
    code: "DEMO-V004",
    vital: "blood_pressure",
    status: "warning",
    text: "DEMO RULE: systolic 140–179 or 80–89, or diastolic 90–119 or below 60, shows Warning. Illustrative only, not clinical guidance.",
  },
  {
    code: "DEMO-V005",
    vital: "spo2",
    status: "critical",
    text: "DEMO RULE: SpO₂ 91% or below shows Critical. Illustrative only, not clinical guidance.",
  },
  {
    code: "DEMO-V006",
    vital: "spo2",
    status: "warning",
    text: "DEMO RULE: SpO₂ 92–94% shows Warning. Illustrative only, not clinical guidance.",
  },
  {
    code: "DEMO-V007",
    vital: "temperature",
    status: "critical",
    text: "DEMO RULE: temperature below 95.0°F or 103.0°F and above shows Critical. Illustrative only, not clinical guidance.",
  },
  {
    code: "DEMO-V008",
    vital: "temperature",
    status: "warning",
    text: "DEMO RULE: temperature 95.0–96.9°F or 99.5–102.9°F shows Warning. Illustrative only, not clinical guidance.",
  },
];

/** DEMO-V001, DEMO-V002. */
export function heartRateStatus(bpm: number): VitalStatus {
  if (bpm < 40 || bpm > 120) return "critical";
  if (bpm < 50 || bpm > 100) return "warning";
  return "stable";
}

/** DEMO-V003, DEMO-V004. */
export function bloodPressureStatus(systolic: number, diastolic: number): VitalStatus {
  if (systolic >= 180 || systolic < 80 || diastolic >= 120) return "critical";
  if (systolic >= 140 || systolic < 90 || diastolic >= 90 || diastolic < 60) return "warning";
  return "stable";
}

/** DEMO-V005, DEMO-V006. */
export function spo2Status(percent: number): VitalStatus {
  if (percent <= 91) return "critical";
  if (percent <= 94) return "warning";
  return "stable";
}

/** DEMO-V007, DEMO-V008. */
export function temperatureStatus(fahrenheit: number): VitalStatus {
  if (fahrenheit < 95 || fahrenheit >= 103) return "critical";
  if (fahrenheit < 97 || fahrenheit >= 99.5) return "warning";
  return "stable";
}

export function vitalStatus(kind: VitalKind, reading: VitalReading): VitalStatus {
  switch (kind) {
    case "heart_rate":
      return heartRateStatus(reading.heart_rate);
    case "blood_pressure":
      return bloodPressureStatus(reading.systolic, reading.diastolic);
    case "spo2":
      return spo2Status(reading.spo2);
    case "temperature":
      return temperatureStatus(reading.temperature_f);
  }
}

const RANK: Record<VitalStatus, number> = { stable: 0, warning: 1, critical: 2 };

export function highestStatus(statuses: readonly VitalStatus[]): VitalStatus {
  return statuses.reduce<VitalStatus>((top, status) => (RANK[status] > RANK[top] ? status : top), "stable");
}

export const VITAL_KINDS: readonly VitalKind[] = ["heart_rate", "blood_pressure", "spo2", "temperature"];

/** The highest status across the four vitals of one reading. */
export function readingStatus(reading: VitalReading): VitalStatus {
  return highestStatus(VITAL_KINDS.map((kind) => vitalStatus(kind, reading)));
}
