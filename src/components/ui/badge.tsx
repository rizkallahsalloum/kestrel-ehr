import type { ReactNode } from "react";
import { cn } from "./cn";
import { severityOutline } from "./severity";

export type Tone = "neutral" | "accent" | "ok" | "warning" | "critical";

const badgeTones: Record<Tone, string> = {
  neutral: "bg-surface-warm text-ink-secondary",
  accent: "bg-accent-subtle text-accent",
  ok: "bg-ok-subtle text-ok",
  warning: "bg-warning-subtle text-warning",
  // Red subtle fill; the inset emphasis ring marks it as blocking without changing the pill's size.
  critical: "bg-danger-subtle text-danger-ink inset-ring-(length:--border-width-emphasis) inset-ring-danger",
};

const badgeSizes = {
  sm: "px-2.5 py-0.5 text-caption",
  // At least 28px tall on one line, 12px medium text, room between the icon and the text.
  md: "min-h-7 gap-1.5 px-3 py-1 text-label-sm",
} as const;

/** Filled status pill (dashboard `.badge`). */
export function Badge({
  tone = "neutral",
  size = "sm",
  className,
  children,
}: {
  tone?: Tone;
  size?: keyof typeof badgeSizes;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      data-severity={tone === "critical" || tone === "warning" ? tone : undefined}
      className={cn(
        "inline-flex items-center rounded-pill font-medium whitespace-nowrap",
        badgeSizes[size],
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
  critical: `${severityOutline.critical} py-0 text-danger`,
  warning: `${severityOutline.warning} py-px text-warning`,
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
      data-severity={severity}
      className={cn(
        "inline-flex shrink-0 items-center rounded-pill bg-surface-pure px-2 text-caption font-semibold",
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
  // Red, with an emphasis-width outline ring around the dot.
  critical:
    "bg-status-critical outline-(length:--border-width-emphasis) outline-offset-(length:--border-width-hairline) outline-status-critical",
} as const;

export type StatusTone = keyof typeof dotTones;

/** 7px status indicator. Pair it with visible text, or pass `label` for screen readers. */
export function StatusDot({ tone, label, className }: { tone: StatusTone; label?: string; className?: string }) {
  return (
    <>
      <span
        aria-hidden="true"
        data-status={tone}
        className={cn("inline-block size-1.75 shrink-0 rounded-full", dotTones[tone], className)}
      />
      {label && <span className="sr-only">{label}</span>}
    </>
  );
}
