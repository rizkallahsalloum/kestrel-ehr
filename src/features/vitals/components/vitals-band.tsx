import type { ReactNode } from "react";
import {
  AlertTriangleIcon,
  cn,
  PrivateText,
  severityIconText,
  severityOutline,
  severityText,
  SkeletonBlock,
  SkeletonLine,
  StatusDot,
} from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import { sparkline, SPARKLINE_HEIGHT, SPARKLINE_WIDTH } from "../sparkline";
import { highestStatus, vitalStatus, type VitalKind, type VitalReading, type VitalStatus } from "../thresholds";
import { unitSeparator, VITAL_UNIT } from "../units";

export type VitalTile = {
  kind: VitalKind;
  label: string;
  value: (reading: VitalReading) => string;
  trend: (reading: VitalReading) => number;
};

const TILES: readonly VitalTile[] = [
  { kind: "heart_rate", label: "Heart rate", value: (r) => String(r.heart_rate), trend: (r) => r.heart_rate },
  {
    kind: "blood_pressure",
    label: "Blood pressure",
    value: (r) => `${r.systolic}/${r.diastolic}`,
    trend: (r) => r.systolic,
  },
  { kind: "spo2", label: "SpO₂", value: (r) => String(r.spo2), trend: (r) => r.spo2 },
  {
    kind: "temperature",
    label: "Temperature",
    value: (r) => Number(r.temperature_f).toFixed(1),
    trend: (r) => Number(r.temperature_f),
  },
];

/** Label and value formatting per vital, shared with the abnormal-vitals banner (units: `../units`). */
export const VITAL_TILE = Object.fromEntries(TILES.map((tile) => [tile.kind, tile])) as Record<VitalKind, VitalTile>;

export const VITAL_STATUS_LABEL: Record<VitalStatus, string> = {
  critical: "Critical",
  warning: "Warning",
  stable: "Stable",
};

const VITALS_DESCRIPTION = "Synthetic readings. Status comes from illustrative demo rules, not clinical guidance.";

// The critical emphasis border takes the place of a quarter step of padding, so every tile is the
// same size whatever its status.
const tileBox: Record<VitalStatus, string> = {
  critical: cn(severityOutline.critical, "p-2.75"),
  warning: cn(severityOutline.warning, "p-3"),
  stable: "border border-line-subtle p-3",
};

const valueText: Record<VitalStatus, string> = {
  critical: severityText.critical,
  warning: severityText.warning,
  stable: "text-ink",
};

/**
 * The value in a fixed-width box (the Privacy mask's width, so masking moves nothing) and its unit,
 * with the shared separator: "108 bpm" with a space, "91%" with the symbol inside the box against
 * the number. The space before a word unit is in the text for screen readers; the flex gap draws it.
 */
function ValueWithUnit({ kind, className, children }: { kind: VitalKind; className?: string; children: ReactNode }) {
  const { unit, spaced } = VITAL_UNIT[kind];
  const unitText = <span className="font-sans text-label-sm font-normal text-ink-muted">{unit}</span>;
  return (
    <p className="flex items-baseline gap-1.5">
      <span className={cn("inline-block min-w-vital-value font-mono text-heading-sm font-semibold", className)}>
        {children}
        {!spaced && unitText}
      </span>
      {spaced && (
        <span className="text-label-sm text-ink-muted">
          {unitSeparator(kind)}
          {unit}
        </span>
      )}
    </p>
  );
}

function StatusLabel({ status }: { status: VitalStatus }) {
  return (
    <p
      data-vital-status={status}
      className={cn(
        "flex items-center gap-1.5 text-label-sm font-semibold",
        status === "stable" ? "text-ink-secondary" : severityText[status],
      )}
    >
      {status === "stable" ? (
        <StatusDot tone="stable" />
      ) : (
        <AlertTriangleIcon className={cn("size-3.5", severityIconText[status])} />
      )}
      {VITAL_STATUS_LABEL[status]}
    </p>
  );
}

/** Decorative trend line: the latest readings, oldest first. Privacy mode hides it (no reveal). */
function Sparkline({ values, status }: { values: number[]; status: VitalStatus }) {
  const { path } = sparkline(values);
  if (!path) return <span aria-hidden="true" className="block h-6" />;
  return (
    <span aria-hidden="true" data-private-value="" data-sparkline="" className="block h-6">
      <svg
        viewBox={`0 0 ${SPARKLINE_WIDTH} ${SPARKLINE_HEIGHT}`}
        preserveAspectRatio="none"
        className={cn("block size-full overflow-visible", status === "stable" ? "text-accent" : severityIconText[status])}
      >
        <path d={path} fill="none" stroke="currentColor" vectorEffect="non-scaling-stroke" className="stroke-2" />
      </svg>
    </span>
  );
}

function summary(statuses: VitalStatus[]): string {
  const critical = statuses.filter((s) => s === "critical").length;
  const warning = statuses.filter((s) => s === "warning").length;
  if (critical === 0 && warning === 0) return "All four vitals stable under the demo rules.";
  return [critical && `${critical} critical`, warning && `${warning} warning`].filter(Boolean).join(", ") + " under the demo rules.";
}

function BandFrame({ time, skeleton = false, children }: { time: ReactNode; skeleton?: boolean; children: ReactNode }) {
  const Heading = skeleton ? "p" : "h2";
  return (
    <>
      <header className="mb-3">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4">
          <Heading id={skeleton ? undefined : "vitals-heading"} className="text-heading-sm font-semibold text-ink">
            Vitals
          </Heading>
          <p className="font-mono text-code-sm whitespace-nowrap text-ink-secondary">{time}</p>
        </div>
        <p className="mt-0.5 text-label-sm text-ink-muted">{VITALS_DESCRIPTION}</p>
      </header>
      <div className="@container">
        <ul aria-label="Latest vitals" className="grid grid-cols-1 gap-3 md:grid-cols-2 md:@vitals-4:grid-cols-4">
          {children}
        </ul>
      </div>
    </>
  );
}

/**
 * Chart vitals band: four tiles with the latest reading, its demo status and a sparkline of the
 * last readings. Status is text plus an icon or dot, never colour alone. Server-rendered.
 */
export function VitalsBand({ readings }: { readings: VitalReading[] }) {
  const latest = readings.at(-1);
  const statuses = latest ? TILES.map((tile) => vitalStatus(tile.kind, latest)) : [];
  const overall = highestStatus(statuses);
  return (
    <section
      aria-labelledby="vitals-heading"
      data-vitals-status={latest ? overall : undefined}
      className="rounded-card border border-line-subtle bg-surface p-5 shadow-level-1"
    >
      <BandFrame
        time={
          latest ? (
            <>
              Latest{" "}
              <PrivateText label="Reading time" className="whitespace-nowrap">
                {formatDateTime(latest.recorded_at)}
              </PrivateText>
            </>
          ) : (
            "No readings"
          )
        }
      >
        {TILES.map((tile, index) => {
          const status = statuses[index];
          return (
            <li
              key={tile.kind}
              data-vital={tile.kind}
              data-severity={status && status !== "stable" ? status : undefined}
              className={cn("flex min-w-0 flex-col gap-2 rounded-control bg-surface-pure", tileBox[status ?? "stable"])}
            >
              <p className="label-caps">{tile.label}</p>
              <ValueWithUnit kind={tile.kind} className={valueText[status ?? "stable"]}>
                {latest ? <PrivateText label={tile.label}>{tile.value(latest)}</PrivateText> : "—"}
              </ValueWithUnit>
              <Sparkline values={readings.map(tile.trend)} status={status ?? "stable"} />
              {status ? (
                <StatusLabel status={status} />
              ) : (
                <p className="text-label-sm text-ink-muted">Not recorded</p>
              )}
            </li>
          );
        })}
      </BandFrame>
      {latest && <p className="sr-only">{summary(statuses)}</p>}
    </section>
  );
}

/** The band with placeholder tiles, for the chart skeleton (rendered inside `aria-hidden`). */
export function VitalsBandSkeleton() {
  return (
    <div data-skeleton="vitals" className="rounded-card border border-line-subtle bg-surface p-5 shadow-level-1">
      <BandFrame skeleton time={<SkeletonLine className="inline-flex align-middle" width="w-44" />}>
        {TILES.map((tile) => (
          <li key={tile.kind} className={cn("flex min-w-0 flex-col gap-2 rounded-control bg-surface-pure", tileBox.stable)}>
            <p className="label-caps">{tile.label}</p>
            <ValueWithUnit kind={tile.kind} className="relative">
              <span className="invisible">000</span>
              <SkeletonBlock className="absolute inset-x-0 inset-y-1.5" />
            </ValueWithUnit>
            <SkeletonBlock className="h-6" />
            <SkeletonLine className="text-label-sm" width="w-16" />
          </li>
        ))}
      </BandFrame>
    </div>
  );
}
