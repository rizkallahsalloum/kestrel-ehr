import { describe, expect, it } from "vitest";
import { calculatedDays, labelLines, sigSentence } from "./sig";

const base = { doseAmount: "1", doseUnit: "tablet", route: "oral", frequency: "twice_daily" };

describe("sigSentence", () => {
  it("builds the directions from dose, unit, route and frequency", () => {
    expect(sigSentence(base)).toBe("Take 1 tablet by mouth twice daily.");
    expect(sigSentence({ ...base, doseAmount: "2" })).toBe("Take 2 tablets by mouth twice daily.");
    expect(sigSentence({ doseAmount: 10, doseUnit: "mg", route: "oral", frequency: "at_bedtime" })).toBe(
      "Take 10 mg by mouth at bedtime.",
    );
  });

  it("uses the verb and phrase of each route", () => {
    expect(sigSentence({ ...base, doseUnit: "g", route: "topical", frequency: "as_needed" })).toBe(
      "Apply 1 g to the skin as needed.",
    );
    expect(sigSentence({ ...base, doseUnit: "mL", route: "subcutaneous", frequency: "once_daily" })).toBe(
      "Inject 1 mL under the skin once daily.",
    );
  });

  it("returns null while the dose is missing or invalid", () => {
    expect(sigSentence({ ...base, doseAmount: "" })).toBeNull();
    expect(sigSentence({ ...base, doseAmount: "0" })).toBeNull();
    expect(sigSentence({ ...base, doseAmount: "abc" })).toBeNull();
    expect(sigSentence({ ...base, route: "nasal" })).toBeNull();
  });
});

describe("calculatedDays", () => {
  it("divides the quantity by the daily count for tablets and capsules", () => {
    expect(calculatedDays({ ...base, quantity: "28" })).toBe(14);
    expect(calculatedDays({ ...base, doseAmount: "2", frequency: "once_daily", quantity: "30" })).toBe(15);
    expect(calculatedDays({ ...base, frequency: "every_8_hours", quantity: "10" })).toBe(3);
  });

  it("has no value without a countable unit, a fixed frequency or a full day's supply", () => {
    expect(calculatedDays({ ...base, doseUnit: "mg", quantity: "28" })).toBeNull();
    expect(calculatedDays({ ...base, frequency: "as_needed", quantity: "28" })).toBeNull();
    expect(calculatedDays({ ...base, quantity: "" })).toBeNull();
    expect(calculatedDays({ ...base, doseAmount: "4", frequency: "four_times_daily", quantity: "10" })).toBeNull();
  });
});

describe("labelLines", () => {
  it("lists patient, medication, directions, instructions and supply, marked as simulated", () => {
    expect(
      labelLines({
        ...base,
        patientName: "Testcase, Rowan",
        medication: "Calvexa 250 mg capsule",
        doseUnit: "capsule",
        quantity: 28,
        refills: 1,
        instructions: " With water ",
      }),
    ).toEqual([
      "Testcase, Rowan",
      "Calvexa 250 mg capsule",
      "Take 1 capsule by mouth twice daily.",
      "With water",
      "Qty 28, refills 1",
      "Simulated label. Synthetic data, not dispensed.",
    ]);
  });
});
