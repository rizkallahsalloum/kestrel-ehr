const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * Short "time ago" text for status lines: "just now", "1 min ago", "5 min ago", "2 hr ago",
 * "over a day ago". A time in the future (clock skew) reads "just now".
 */
export function formatRelativeTime(then: number, now: number): string {
  const elapsed = now - then;
  if (!Number.isFinite(elapsed) || elapsed < MINUTE) return "just now";
  if (elapsed < HOUR) return `${Math.floor(elapsed / MINUTE)} min ago`;
  if (elapsed < DAY) return `${Math.floor(elapsed / HOUR)} hr ago`;
  return "over a day ago";
}
