import type { ReactNode } from "react";
import { cn } from "./cn";
import { CheckCircleIcon } from "./icons";
import { severityIcons, severityOutline } from "./severity";

const tones = {
  critical: {
    box: severityOutline.critical,
    icon: "ring-(length:--border-width-emphasis) ring-warning-stroke",
    Icon: severityIcons.critical,
  },
  warning: {
    box: severityOutline.warning,
    icon: "ring-1 ring-warning-line",
    Icon: severityIcons.warning,
  },
} as const;

/**
 * Chart-level alert (dashboard `.alert-banner`). Static by default; pass `role="alert"` only
 * when the banner appears in response to a user action.
 */
export function AlertBanner({
  tone,
  title,
  actions,
  role,
  className,
  children,
}: {
  tone: keyof typeof tones;
  title: ReactNode;
  actions?: ReactNode;
  role?: "alert" | "region";
  className?: string;
  children?: ReactNode;
}) {
  const t = tones[tone];
  return (
    <div role={role} className={cn("flex items-start gap-3.5 rounded-card bg-warning-subtle px-5 py-4", t.box, className)}>
      <span
        className={cn("grid size-8.5 shrink-0 place-items-center rounded-full bg-surface-pure text-warning", t.icon)}
      >
        <t.Icon />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-label font-semibold text-warning">{title}</p>
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
