import { describe, expect, it } from "vitest";
import {
  bloodPressureStatus,
  heartRateStatus,
  highestStatus,
  readingStatus,
  spo2Status,
  temperatureStatus,
  VITAL_RULES,
  type VitalReading,
} from "./thresholds";

describe("DEMO vitals rules", () => {
  it("labels every rule as a demo rule, not clinical guidance", () => {
    expect(VITAL_RULES.map((rule) => rule.code)).toEqual([
      "DEMO-V001",
      "DEMO-V002",
      "DEMO-V003",
      "DEMO-V004",
      "DEMO-V005",
      "DEMO-V006",
      "DEMO-V007",
      "DEMO-V008",
    ]);
    for (const rule of VITAL_RULES) {
      expect(rule.text).toMatch(/^DEMO RULE: /);
      expect(rule.text).toMatch(/Illustrative only, not clinical guidance\.$/);
    }
  });

  it("heart rate: stable 50–100, warning 40–49 or 101–120, critical beyond", () => {
    expect([39, 40, 49, 50, 100, 101, 120, 121].map(heartRateStatus)).toEqual([
      "critical",
      "warning",
      "warning",
      "stable",
      "stable",
      "warning",
      "warning",
      "critical",
    ]);
  });

  it("blood pressure: systolic and diastolic bands", () => {
    expect(bloodPressureStatus(118, 76)).toBe("stable");
    expect(bloodPressureStatus(139, 89)).toBe("stable");
    expect(bloodPressureStatus(90, 60)).toBe("stable");
    expect(bloodPressureStatus(148, 92)).toBe("warning");
    expect(bloodPressureStatus(140, 80)).toBe("warning");
    expect(bloodPressureStatus(120, 90)).toBe("warning");
    expect(bloodPressureStatus(89, 60)).toBe("warning");
    expect(bloodPressureStatus(110, 59)).toBe("warning");
    expect(bloodPressureStatus(179, 119)).toBe("warning");
    expect(bloodPressureStatus(180, 100)).toBe("critical");
    expect(bloodPressureStatus(79, 50)).toBe("critical");
    expect(bloodPressureStatus(150, 120)).toBe("critical");
  });

  it("SpO₂: stable from 95, warning 92–94, critical at 91 and below", () => {
    expect([91, 92, 94, 95, 100].map(spo2Status)).toEqual(["critical", "warning", "warning", "stable", "stable"]);
  });

  it("temperature: stable 97.0–99.4 °F, warning to 95.0 and 102.9, critical beyond", () => {
    expect([94.9, 95, 96.9, 97, 99.4, 99.5, 102.9, 103].map(temperatureStatus)).toEqual([
      "critical",
      "warning",
      "warning",
      "stable",
      "stable",
      "warning",
      "warning",
      "critical",
    ]);
  });

  it("a reading takes its most severe vital", () => {
    const stable: VitalReading = {
      recorded_at: "2026-10-12T09:00:00Z",
      heart_rate: 72,
      systolic: 118,
      diastolic: 76,
      spo2: 98,
      temperature_f: 98.4,
    };
    expect(readingStatus(stable)).toBe("stable");
    expect(readingStatus({ ...stable, heart_rate: 108 })).toBe("warning");
    expect(readingStatus({ ...stable, heart_rate: 108, spo2: 91 })).toBe("critical");
    expect(highestStatus([])).toBe("stable");
    expect(highestStatus(["warning", "stable"])).toBe("warning");
  });
});
