import type { Allergy } from "@/types/domain";

type Severity = Allergy["severity"];

const RANK: Record<Severity, number> = { mild: 1, moderate: 2, severe: 3 };

export function highestSeverity(allergies: Pick<Allergy, "severity">[]): Severity | null {
  let highest: Severity | null = null;
  for (const { severity } of allergies) {
    if (!highest || RANK[severity] > RANK[highest]) highest = severity;
  }
  return highest;
}

/** Most severe first; the original order is kept within a severity. */
export function bySeverity<T extends Pick<Allergy, "severity">>(allergies: T[]): T[] {
  return [...allergies].sort((a, b) => RANK[b.severity] - RANK[a.severity]);
}

/**
 * Severe allergies get the blocking ("critical") treatment, mild and moderate the advisory one.
 * Both are orange; blocking adds the emphasis border and circle icon. See docs/theme.md, "Red and orange".
 */
export function allergyTone(severity: Severity): "critical" | "warning" {
  return severity === "severe" ? "critical" : "warning";
}
