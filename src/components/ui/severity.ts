/**
 * Severity colours (docs/theme.md, "Severity colours"). Severe and critical states use the error
 * (red) tokens; moderate and warning states the warning (orange) tokens; stable states the ok
 * (green) tokens. Blocking ("critical") and advisory ("warning") also differ by the emphasis border
 * width, their label text and their order (blocking first), never by colour alone. Every severity
 * uses the triangle alert icon (`AlertTriangleIcon`).
 */
export type Severity = "critical" | "warning";

/** Box outline: emphasis width in `danger` for critical, a hairline in `warning-line` for warning. */
export const severityOutline = {
  critical: "border-(length:--border-width-emphasis) border-danger",
  warning: "border border-warning-line",
} as const;

/** Subtle fill behind a severity box, pill or banner. */
export const severityFill = {
  critical: "bg-danger-subtle",
  warning: "bg-warning-subtle",
} as const;

/** Title and name text on a severity fill or a plain surface. */
export const severityText = {
  critical: "text-danger-ink",
  warning: "text-warning",
} as const;

/** Icon colour. */
export const severityIconText = {
  critical: "text-danger",
  warning: "text-warning",
} as const;

/** Hairline row dividers inside a severity panel. */
export const severityDivider = {
  critical: "border-danger-line",
  warning: "border-warning-line",
} as const;
