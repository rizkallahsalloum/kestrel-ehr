import { describe, expect, it } from "vitest";
import { sparkline, SPARKLINE_HEIGHT, SPARKLINE_WIDTH } from "./sparkline";

describe("sparkline", () => {
  it("gives no path for fewer than two values", () => {
    expect(sparkline([])).toEqual({ points: [], path: "" });
    expect(sparkline([97])).toEqual({ points: [], path: "" });
  });

  it("spreads points evenly inside the viewBox, highest value at the top", () => {
    const { points, path } = sparkline([97, 96, 95, 94, 92, 91]);
    expect(points).toHaveLength(6);
    expect(points[0]!.x).toBeGreaterThan(0);
    expect(points.at(-1)!.x).toBeLessThan(SPARKLINE_WIDTH);
    expect(points[0]!.y).toBeLessThan(points.at(-1)!.y);
    for (const point of points) {
      expect(point.y).toBeGreaterThanOrEqual(0);
      expect(point.y).toBeLessThanOrEqual(SPARKLINE_HEIGHT);
    }
    expect(path.startsWith("M")).toBe(true);
    expect(path.match(/L/g)).toHaveLength(5);
  });

  it("draws a flat series on the middle line", () => {
    const { points } = sparkline([98, 98, 98]);
    expect(points.map((p) => p.y)).toEqual([SPARKLINE_HEIGHT / 2, SPARKLINE_HEIGHT / 2, SPARKLINE_HEIGHT / 2]);
  });
});
