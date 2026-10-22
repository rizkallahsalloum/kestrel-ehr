import { describe, expect, it } from "vitest";
import { formatRelativeTime } from "./relative-time";

const NOW = Date.UTC(2026, 9, 22, 12, 0, 0);
const ago = (ms: number) => formatRelativeTime(NOW - ms, NOW);

describe("formatRelativeTime", () => {
  it.each([
    [0, "just now"],
    [59_999, "just now"],
    [60_000, "1 min ago"],
    [119_999, "1 min ago"],
    [120_000, "2 min ago"],
    [59 * 60_000 + 59_000, "59 min ago"],
    [60 * 60_000, "1 hr ago"],
    [23 * 3_600_000 + 59 * 60_000, "23 hr ago"],
    [24 * 3_600_000, "over a day ago"],
  ])("%i ms ago reads %s", (elapsed, text) => {
    expect(ago(elapsed)).toBe(text);
  });

  it("reads a future time as just now", () => {
    expect(ago(-5 * 60_000)).toBe("just now");
  });

  it("reads an invalid time as just now", () => {
    expect(formatRelativeTime(Number.NaN, NOW)).toBe("just now");
  });
});
