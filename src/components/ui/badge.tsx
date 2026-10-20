import type { ReactNode } from "react";
import { cn } from "./cn";
import { severityOutline } from "./severity";

export type Tone = "neutral" | "accent" | "ok" | "warning" | "critical";

const badgeTones: Record<Tone, string> = {
  neutral: "bg-surface-warm text-ink-secondary",
  accent: "bg-accent-subtle text-accent",
  ok: "bg-ok-subtle text-ok",
  warning: "bg-warning-subtle text-warning",
  // Same palette as warning; the inset emphasis ring sets it apart without changing the pill's size.
  critical: "bg-warning-subtle text-warning inset-ring-(length:--border-width-emphasis) inset-ring-warning-stroke",
};

/** Filled status pill (dashboard `.badge`). */
export function Badge({ tone = "neutral", className, children }: { tone?: Tone; className?: string; children: ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-pill px-2.5 py-0.5 text-caption font-medium whitespace-nowrap",
        badgeTones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Outlined descriptive tag on a warm fill (E-Rx and dashboard `.tag`). */
export function Tag({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-pill border border-line-subtle bg-surface-warm px-2.5 py-0.5 text-label-sm text-ink-secondary",
        className,
      )}
    >
      {children}
    </span>
  );
}

// The thicker blocking border takes the place of one pixel of padding, so both tags are the same height.
const severityTones = {
  critical: `${severityOutline.critical} py-0`,
  warning: `${severityOutline.warning} py-px`,
} as const;

/** Severity marker on a white chip (dashboard `.sev-tag`). Text carries the meaning, not colour alone. */
export function SeverityTag({
  severity,
  className,
  children,
}: {
  severity: keyof typeof severityTones;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-pill bg-surface-pure px-2 text-caption font-semibold text-warning",
        severityTones[severity],
        className,
      )}
    >
      {children}
    </span>
  );
}

const dotTones = {
  stable: "bg-status-stable",
  warning: "bg-status-warning",
  // Orange like warning, with an emphasis-width outline ring around the dot.
  critical:
    "bg-status-warning outline-(length:--border-width-emphasis) outline-offset-(length:--border-width-hairline) outline-status-warning",
} as const;

/** 7px status indicator. Pair it with visible text, or pass `label` for screen readers. */
export function StatusDot({ tone, label, className }: { tone: keyof typeof dotTones; label?: string; className?: string }) {
  return (
    <>
      <span aria-hidden="true" className={cn("inline-block size-1.75 shrink-0 rounded-full", dotTones[tone], className)} />
      {label && <span className="sr-only">{label}</span>}
    </>
  );
}
