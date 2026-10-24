import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { VitalReading } from "../thresholds";
import { AbnormalVitalsBanner } from "./abnormal-vitals-banner";

const STABLE: VitalReading = {
  recorded_at: "2026-10-14T14:00:00Z",
  heart_rate: 70,
  systolic: 118,
  diastolic: 76,
  spo2: 99,
  temperature_f: 98.4,
};

const items = () => [...document.querySelectorAll("[data-abnormal-vitals] li")].map((li) => li.textContent);

describe("AbnormalVitalsBanner", () => {
  it("renders nothing without a reading or when every vital is stable", () => {
    const { container, rerender } = render(<AbnormalVitalsBanner reading={undefined} />);
    expect(container.innerHTML).toBe("");
    rerender(<AbnormalVitalsBanner reading={STABLE} />);
    expect(container.innerHTML).toBe("");
  });

  it("renders nothing for warning-only vitals: the tile carries the warning", () => {
    const { container } = render(<AbnormalVitalsBanner reading={{ ...STABLE, systolic: 148, diastolic: 92, heart_rate: 108 }} />);
    expect(container.innerHTML).toBe("");
  });

  it("shows a critical banner naming the critical vitals, and lists warnings below them", () => {
    render(<AbnormalVitalsBanner reading={{ ...STABLE, heart_rate: 108, spo2: 91 }} />);
    expect(screen.getByText("Critical vital sign on the latest reading: SpO₂")).toBeTruthy();
    expect(document.querySelector("[data-severity]")!.getAttribute("data-severity")).toBe("critical");
    expect(items()).toEqual(["SpO₂ 91 %: Critical (DEMO-V005)", "Heart rate 108 bpm: Warning (DEMO-V002)"]);
  });

  it("names every critical vital in the title", () => {
    render(<AbnormalVitalsBanner reading={{ ...STABLE, spo2: 90, temperature_f: 103.4, systolic: 150 }} />);
    expect(screen.getByText("Critical vital signs on the latest reading: SpO₂, Temperature")).toBeTruthy();
    expect(items()).toEqual([
      "SpO₂ 90 %: Critical (DEMO-V005)",
      "Temperature 103.4 °F: Critical (DEMO-V007)",
      "Blood pressure 150/76 mmHg: Warning (DEMO-V004)",
    ]);
  });
});
