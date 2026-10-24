import { describe, expect, it } from "vitest";
import { unitSeparator, withUnit } from "./units";

describe("vital units", () => {
  it("puts a space before word units and none before symbol units", () => {
    expect(withUnit("heart_rate", "108")).toBe("108 bpm");
    expect(withUnit("blood_pressure", "148/92")).toBe("148/92 mmHg");
    expect(withUnit("spo2", "91")).toBe("91%");
    expect(withUnit("temperature", "98.4")).toBe("98.4°F");
  });

  it("exposes the separator on its own for values rendered separately (masked under Privacy mode)", () => {
    expect(unitSeparator("heart_rate")).toBe(" ");
    expect(unitSeparator("blood_pressure")).toBe(" ");
    expect(unitSeparator("spo2")).toBe("");
    expect(unitSeparator("temperature")).toBe("");
  });
});
