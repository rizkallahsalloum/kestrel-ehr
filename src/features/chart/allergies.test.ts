import { describe, expect, it } from "vitest";
import { allergyTone, bySeverity, highestSeverity } from "./allergies";

describe("highestSeverity", () => {
  it("returns null without allergies", () => {
    expect(highestSeverity([])).toBeNull();
  });

  it("picks the most severe regardless of order", () => {
    expect(highestSeverity([{ severity: "mild" }, { severity: "severe" }, { severity: "moderate" }])).toBe("severe");
    expect(highestSeverity([{ severity: "mild" }, { severity: "moderate" }])).toBe("moderate");
    expect(highestSeverity([{ severity: "mild" }])).toBe("mild");
  });
});

describe("allergyTone", () => {
  it("gives severe allergies the blocking treatment", () => {
    expect(allergyTone("severe")).toBe("critical");
    expect(allergyTone("moderate")).toBe("warning");
    expect(allergyTone("mild")).toBe("warning");
  });
});

describe("bySeverity", () => {
  it("puts the most severe first and keeps the order within a severity", () => {
    const allergies = [
      { id: "a", severity: "mild" as const },
      { id: "b", severity: "severe" as const },
      { id: "c", severity: "moderate" as const },
      { id: "d", severity: "severe" as const },
    ];
    expect(bySeverity(allergies).map((a) => a.id)).toEqual(["b", "d", "c", "a"]);
    expect(allergies.map((a) => a.id)).toEqual(["a", "b", "c", "d"]);
  });
});
