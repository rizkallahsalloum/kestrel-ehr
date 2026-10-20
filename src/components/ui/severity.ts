import { AlertCircleIcon, AlertTriangleIcon } from "./icons";

/**
 * Blocking and advisory states share the orange palette; red is reserved for destructive confirms.
 * Blocking is told apart by the emphasis border width, the circle icon, its label text and coming
 * first, never by colour alone. See docs/theme.md, "Red and orange".
 */
export const severityOutline = {
  critical: "border-(length:--border-width-emphasis) border-warning-stroke",
  warning: "border border-warning-line",
} as const;

export const severityIcons = { critical: AlertCircleIcon, warning: AlertTriangleIcon } as const;
