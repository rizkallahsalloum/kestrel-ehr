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
 * is red with the emphasis border; warning (advisory) is orange with a hairline. Static by default;
 * pass `role="alert"` only when the banner appears in response to a user action.
 */
export function AlertBanner({
  tone,
  title,
  actions,
  role,
  className,
  children,
}: {
  tone: Severity;
  title: ReactNode;
  actions?: ReactNode;
  role?: "alert" | "region";
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
          "grid size-8.5 shrink-0 place-items-center rounded-full bg-surface-pure",
          severityIconText[tone],
          iconRings[tone],
        )}
      >
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
