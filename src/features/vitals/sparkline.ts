/** The sparkline viewBox. The SVG scales to its box, so these are units, not pixels. */
export const SPARKLINE_WIDTH = 100;
export const SPARKLINE_HEIGHT = 24;
const INSET = 2;

export type SparklinePoint = { x: number; y: number };

/**
 * Maps values (oldest first) to points in the sparkline viewBox and an SVG
 * path through them. A flat series sits on the middle line. Fewer than two
 * values give no path.
 */
export function sparkline(values: readonly number[]): { points: SparklinePoint[]; path: string } {
  if (values.length < 2) return { points: [], path: "" };
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min;
  const usableHeight = SPARKLINE_HEIGHT - INSET * 2;
  const step = (SPARKLINE_WIDTH - INSET * 2) / (values.length - 1);
  const points = values.map((value, index) => ({
    x: round(INSET + step * index),
    y: round(span === 0 ? SPARKLINE_HEIGHT / 2 : INSET + usableHeight * (1 - (value - min) / span)),
  }));
  const path = points.map((point, index) => `${index === 0 ? "M" : "L"}${point.x} ${point.y}`).join(" ");
  return { points, path };
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
