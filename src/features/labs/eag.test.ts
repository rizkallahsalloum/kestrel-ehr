import { describe, expect, it } from "vitest";
import { hba1cChartScale } from "./chart-scale";
import { eagFromHba1c } from "./eag";

describe("eagFromHba1c", () => {
  it("uses 28.7 × HbA1c − 46.7, rounded", () => {
    expect([7.8, 7.6, 7.3, 7.1, 6.9, 6.8, 5.6].map(eagFromHba1c)).toEqual([177, 171, 163, 157, 151, 148, 114]);
    expect(eagFromHba1c(6)).toBe(126);
  });
});

describe("hba1cChartScale", () => {
  const series = [7.8, 7.6, 7.3, 7.1, 6.9, 6.8].map((value, i) => ({ collectedOn: `2026-0${3 + i}-15`, value }));

  it("returns null without results", () => {
    expect(hba1cChartScale([])).toBeNull();
  });

  it("puts half-percent ticks around the data, with eAG labels on the same lines", () => {
    const scale = hba1cChartScale(series)!;
    expect(scale.min).toBe(6.5);
    expect(scale.max).toBe(8.5);
    expect(scale.ticks.map((t) => t.hba1c)).toEqual([6.5, 7, 7.5, 8, 8.5]);
    expect(scale.ticks.map((t) => t.eag)).toEqual([140, 154, 169, 183, 197]);
    expect(scale.ticks[0]!.y).toBe(100);
    expect(scale.ticks.at(-1)!.y).toBe(0);
  });

  it("orders points oldest first, spread evenly, inside the axis range", () => {
    const scale = hba1cChartScale([...series].reverse())!;
    expect(scale.points.map((p) => p.collectedOn)).toEqual(series.map((p) => p.collectedOn));
    expect(scale.points.map((p) => p.x)).toEqual([0, 20, 40, 60, 80, 100]);
    expect(scale.points.map((p) => p.eag)).toEqual([177, 171, 163, 157, 151, 148]);
    for (const point of scale.points) {
      expect(point.y).toBeGreaterThan(0);
      expect(point.y).toBeLessThan(100);
    }
  });

  it("centres a single result", () => {
    const scale = hba1cChartScale([{ collectedOn: "2026-07-10", value: 5.6 }])!;
    expect(scale.points[0]!.x).toBe(50);
    expect(scale.min).toBe(5);
    expect(scale.max).toBe(6);
  });
});
