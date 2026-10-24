import { describe, expect, it } from "vitest";
import { abnormalVitals } from "./abnormal";
import type { VitalReading } from "./thresholds";

const STABLE: VitalReading = {
  recorded_at: "2026-10-12T09:00:00Z",
  heart_rate: 70,
  systolic: 118,
  diastolic: 76,
  spo2: 99,
  temperature_f: 98.4,
};

const summary = (reading: VitalReading) => abnormalVitals(reading).map((v) => `${v.kind}:${v.status}:${v.rule.code}`);

describe("abnormalVitals", () => {
  it("is empty when every vital is stable", () => {
    expect(abnormalVitals(STABLE)).toEqual([]);
  });

  it("names the demo rule for each abnormal vital", () => {
    expect(summary({ ...STABLE, systolic: 148, diastolic: 92 })).toEqual(["blood_pressure:warning:DEMO-V004"]);
    expect(summary({ ...STABLE, spo2: 91 })).toEqual(["spo2:critical:DEMO-V005"]);
    expect(summary({ ...STABLE, temperature_f: 103 })).toEqual(["temperature:critical:DEMO-V007"]);
    expect(summary({ ...STABLE, heart_rate: 39 })).toEqual(["heart_rate:critical:DEMO-V001"]);
  });

  it("lists critical vitals first, then warnings, each in band order", () => {
    expect(summary({ ...STABLE, heart_rate: 108, spo2: 91 })).toEqual([
      "spo2:critical:DEMO-V005",
      "heart_rate:warning:DEMO-V002",
    ]);
    expect(summary({ ...STABLE, heart_rate: 130, systolic: 150, spo2: 93, temperature_f: 104 })).toEqual([
      "heart_rate:critical:DEMO-V001",
      "temperature:critical:DEMO-V007",
      "blood_pressure:warning:DEMO-V004",
      "spo2:warning:DEMO-V006",
    ]);
  });

  it("treats band edges as the demo rules do", () => {
    expect(summary({ ...STABLE, spo2: 95 })).toEqual([]);
    expect(summary({ ...STABLE, spo2: 94 })).toEqual(["spo2:warning:DEMO-V006"]);
    expect(summary({ ...STABLE, spo2: 92 })).toEqual(["spo2:warning:DEMO-V006"]);
    expect(summary({ ...STABLE, heart_rate: 100 })).toEqual([]);
    expect(summary({ ...STABLE, heart_rate: 120 })).toEqual(["heart_rate:warning:DEMO-V002"]);
  });
});
