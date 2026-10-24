import type { ReactNode } from "react";
import { cn } from "./cn";
import { AlertTriangleIcon, CheckCircleIcon } from "./icons";
import { severityFill, severityIconText, severityOutline, severityText, type Severity } from "./severity";

const iconRings: Record<Severity, string> = {
  critical: "ring-(length:--border-width-emphasis) ring-danger",
  warning: "ring-1 ring-warning-line",
};

/**
 * Chart-level alert (dashboard `.alert-banner`). Critical (blocking, for example an allergy conflict)
 * is red with the emphasis border; warning (advisory) is orange with a hairline. No role by default.
 * Chart safety banners use `role="alert"` with `pulse` when critical and `role="status"` (polite)
 * when warning. `pulse` animates the icon dot, never the block, and only without reduced motion.
 */
export function AlertBanner({
  tone,
  title,
  actions,
  role,
  pulse = false,
  className,
  children,
}: {
  tone: Severity;
  title: ReactNode;
  actions?: ReactNode;
  role?: "alert" | "status" | "region";
  pulse?: boolean;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div
      role={role}
      data-severity={tone}
      className={cn("flex items-start gap-3.5 rounded-card px-5 py-4", severityFill[tone], severityOutline[tone], className)}
    >
      <span
        className={cn(
          "relative grid size-8.5 shrink-0 place-items-center rounded-full bg-surface-pure",
          severityIconText[tone],
          iconRings[tone],
        )}
      >
        {pulse && (
          <span aria-hidden="true" data-alert-pulse="" className="absolute inset-0 rounded-full motion-safe:animate-alert-pulse" />
        )}
        <AlertTriangleIcon />
      </span>
      <div className="min-w-0 flex-1">
        <p className={cn("text-label font-semibold", severityText[tone])}>{title}</p>
        {children && <div className="mt-0.5 text-body-sm text-ink-strong">{children}</div>}
        {actions && <div className="mt-3 flex flex-wrap gap-2.5">{actions}</div>}
      </div>
    </div>
  );
}

/** Dashed "nothing to report" state (dashboard `.no-alert`). */
export function NoAlert({
  icon = <CheckCircleIcon className="text-ok" />,
  className,
  children,
}: {
  icon?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2.5 rounded-card border border-dashed border-line px-5 py-3.5 text-body-sm text-ink-muted",
        className,
      )}
    >
      {icon}
      <span>{children}</span>
    </div>
  );
}
