import type { ReactNode } from "react";

/** Upper bound on `?delay=` so a typo cannot hang a specimen page. */
const MAX_DELAY_MS = 5000;

/** Parses a specimen `?delay=` value in milliseconds; 0 means render immediately. */
export function delayParam(value: string | string[] | undefined): number {
  const ms = Number(Array.isArray(value) ? value[0] : value);
  return Number.isFinite(ms) && ms > 0 ? Math.min(ms, MAX_DELAY_MS) : 0;
}

/** Holds its children back for `ms` so the route's skeleton streams first (layout-shift checks). */
export async function Delayed({ ms, children }: { ms: number; children: ReactNode }) {
  await new Promise((resolve) => setTimeout(resolve, ms));
  return children;
}
