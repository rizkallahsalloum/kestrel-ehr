import type { ReactNode } from "react";
import { cn } from "./cn";
import { severityIconText, severityOutline } from "./severity";

type HeadingLevel = 2 | 3;

export function CardHeader({
  title,
  description,
  actions,
  headingLevel = 2,
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  headingLevel?: HeadingLevel;
}) {
  const Heading = headingLevel === 2 ? "h2" : "h3";
  return (
    <header className="mb-3 flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
      <div className="min-w-0 flex-1 basis-60">
        {title && <Heading className="text-heading-sm font-semibold text-ink">{title}</Heading>}
        {description && <p className="mt-0.5 text-label-sm text-ink-muted">{description}</p>}
      </div>
      {actions}
    </header>
  );
}

/** Surface card (dashboard and E-Rx `.card`). `tone="critical"` adds the blocking emphasis outline. */
export function Card({
  title,
  description,
  actions,
  headingLevel,
  elevated = false,
  tone = "default",
  className,
  children,
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  headingLevel?: HeadingLevel;
  elevated?: boolean;
  tone?: "default" | "critical";
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      data-severity={tone === "critical" ? tone : undefined}
      className={cn(
        "rounded-card bg-surface p-5",
        tone === "critical" ? severityOutline.critical : "border border-line-subtle",
        elevated && "shadow-level-1",
        className,
      )}
    >
      {(title || actions) && (
        <CardHeader title={title} description={description} actions={actions} headingLevel={headingLevel} />
      )}
      {children}
    </section>
  );
}

const panelIconTones = { default: "text-ink-muted", ...severityIconText } as const;

/** Small icon-led panel heading (dashboard `.panel-title`). */
export function PanelTitle({
  icon,
  tone = "default",
  as: Heading = "h3",
  children,
}: {
  icon?: ReactNode;
  tone?: "default" | "warning" | "critical";
  as?: "h2" | "h3" | "h4";
  children: ReactNode;
}) {
  return (
    <Heading className="flex items-center gap-2 text-label font-semibold text-ink">
      {icon && <span className={cn("flex", panelIconTones[tone])}>{icon}</span>}
      {children}
    </Heading>
  );
}
