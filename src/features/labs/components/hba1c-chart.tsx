import type { ReactNode } from "react";
import { Card, cn, PrivateRegion, SkeletonBlock } from "@/components/ui";
import { hba1cChartScale, type Hba1cPoint, type PlottedPoint } from "../chart-scale";

const MONTH = new Intl.DateTimeFormat("en-GB", { month: "short", year: "numeric", timeZone: "UTC" });
const MONTH_SHORT = new Intl.DateTimeFormat("en-GB", { month: "short", timeZone: "UTC" });

export const HBA1C_TITLE = "HbA1c and estimated average glucose";
export const HBA1C_DESCRIPTION = "Synthetic results. eAG is calculated from HbA1c (28.7 × HbA1c − 46.7), not measured.";

function monthLabel(date: string): string {
  return MONTH.format(new Date(`${date}T00:00:00Z`));
}

function pointLabel(point: PlottedPoint): string {
  return `${monthLabel(point.collectedOn)}: HbA1c ${point.value.toFixed(1)}%, eAG ${point.eag} mg/dL`;
}

/** Tooltips near the plot edges open inwards so they stay inside the card. */
function tooltipAlign(x: number): string {
  if (x < 20) return "left-0";
  if (x > 80) return "right-0";
  return "left-1/2 -translate-x-1/2";
}

/**
 * Chart box shared by the chart, its empty state and the skeleton, so all three are the same
 * height: axis titles, the plot between the two axis columns, then the month row.
 */
export function Hba1cChartFrame({
  left,
  plot,
  right,
  months,
  axisTitles = true,
}: {
  left?: ReactNode;
  plot: ReactNode;
  right?: ReactNode;
  months?: ReactNode;
  axisTitles?: boolean;
}) {
  return (
    <>
      <div aria-hidden="true" className="mb-2 flex h-lh justify-between text-label-sm text-ink-secondary">
        {axisTitles && (
          <>
            <span>HbA1c (%)</span>
            <span>eAG (mg/dL)</span>
          </>
        )}
      </div>
      <div className="flex gap-2">
        <div aria-hidden="true" className="relative w-8 shrink-0 font-mono text-code-sm text-ink-secondary">
          {left}
        </div>
        <div className="relative aspect-chart min-w-0 flex-1">{plot}</div>
        <div aria-hidden="true" className="relative w-8 shrink-0 font-mono text-code-sm text-ink-secondary">
          {right}
        </div>
      </div>
      <div aria-hidden="true" className="relative mx-14 mt-2 h-4 text-label-sm text-ink-secondary">
        {months}
      </div>
    </>
  );
}

function Plot({ points, ticks }: { points: PlottedPoint[]; ticks: { hba1c: number; y: number }[] }) {
  return (
    <>
      <svg
        aria-hidden="true"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="absolute inset-0 size-full overflow-visible"
      >
        {ticks.map((tick) => (
          <line
            key={tick.hba1c}
            x1={0}
            x2={100}
            y1={tick.y}
            y2={tick.y}
            vectorEffect="non-scaling-stroke"
            className="stroke-line stroke-1"
          />
        ))}
      </svg>
      <div className="absolute inset-x-4 inset-y-0">
        {points.length > 1 && (
          <svg
            aria-hidden="true"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="absolute inset-0 size-full overflow-visible"
          >
            <polyline
              points={points.map((point) => `${point.x},${point.y}`).join(" ")}
              fill="none"
              vectorEffect="non-scaling-stroke"
              className="stroke-accent stroke-2"
            />
          </svg>
        )}
        {points.map((point) => (
          <span
            key={point.collectedOn}
            tabIndex={0}
            role="img"
            aria-label={pointLabel(point)}
            data-chart-point=""
            className="group absolute size-3 -translate-1/2 rounded-full border-2 border-surface-pure bg-accent hover:z-10 focus-visible:z-10"
            style={{ left: `${point.x}%`, top: `${point.y}%` }}
          >
            <span
              aria-hidden="true"
              data-chart-tooltip=""
              className={cn(
                "pointer-events-none invisible absolute bottom-full mb-2 rounded-control bg-inverse px-2 py-1 text-label-sm whitespace-nowrap text-on-inverse group-hover:visible group-focus-visible:visible",
                tooltipAlign(point.x),
              )}
            >
              {monthLabel(point.collectedOn)} · {point.value.toFixed(1)}% · eAG {point.eag} mg/dL
            </span>
          </span>
        ))}
      </div>
    </>
  );
}

/**
 * HbA1c over time with estimated average glucose. One series: eAG is derived from HbA1c, so the
 * right axis labels the same tick lines in mg/dL. Points are keyboard-focusable with a tooltip; a
 * visually hidden table carries the same values for screen readers. Privacy mode hides the whole
 * region (the shape alone shows the trend). Server-rendered, no client script.
 */
export function Hba1cChart({ results }: { results: Hba1cPoint[] }) {
  const scale = hba1cChartScale(results);
  return (
    <Card elevated title={HBA1C_TITLE} description={HBA1C_DESCRIPTION}>
      {scale ? (
        <PrivateRegion label="HbA1c chart">
          <figure aria-labelledby="hba1c-caption" data-hba1c-chart="">
            <figcaption id="hba1c-caption" className="sr-only">
              HbA1c results with estimated average glucose, oldest first
            </figcaption>
            <Hba1cChartFrame
              left={scale.ticks.map((tick) => (
                <span key={tick.hba1c} className="absolute right-0 -translate-y-1/2" style={{ top: `${tick.y}%` }}>
                  {tick.hba1c.toFixed(1)}
                </span>
              ))}
              plot={<Plot points={scale.points} ticks={scale.ticks} />}
              right={scale.ticks.map((tick) => (
                <span key={tick.hba1c} className="absolute left-0 -translate-y-1/2" style={{ top: `${tick.y}%` }}>
                  {tick.eag}
                </span>
              ))}
              months={scale.points.map((point) => (
                <span
                  key={point.collectedOn}
                  className="absolute -translate-x-1/2 whitespace-nowrap"
                  style={{ left: `${point.x}%` }}
                >
                  {MONTH_SHORT.format(new Date(`${point.collectedOn}T00:00:00Z`))}
                </span>
              ))}
            />
            {/* The wrapper is visually hidden: a table box ignores sr-only's width and clipping. */}
            <div className="sr-only">
            <table>
              <caption>HbA1c results and estimated average glucose (eAG), oldest first</caption>
              <thead>
                <tr>
                  <th scope="col">Collected</th>
                  <th scope="col">HbA1c (%)</th>
                  <th scope="col">eAG (mg/dL)</th>
                </tr>
              </thead>
              <tbody>
                {scale.points.map((point) => (
                  <tr key={point.collectedOn}>
                    <th scope="row">{monthLabel(point.collectedOn)}</th>
                    <td>{point.value.toFixed(1)}</td>
                    <td>{point.eag}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </figure>
        </PrivateRegion>
      ) : (
        <Hba1cChartFrame
          axisTitles={false}
          plot={
            <p className="absolute inset-0 flex items-center justify-center rounded-control bg-surface-warm text-body-sm text-ink-secondary">
              No HbA1c results on file.
            </p>
          }
        />
      )}
    </Card>
  );
}

/** The chart card with placeholder content, for the chart skeleton (rendered inside `aria-hidden`). */
export function Hba1cChartSkeleton() {
  return (
    <div className="rounded-card border border-line-subtle bg-surface p-5 shadow-level-1">
      <div className="mb-3">
        <p className="text-heading-sm font-semibold text-ink">{HBA1C_TITLE}</p>
        <p className="mt-0.5 text-label-sm text-ink-muted">{HBA1C_DESCRIPTION}</p>
      </div>
      <Hba1cChartFrame axisTitles={false} plot={<SkeletonBlock className="absolute inset-0" />} />
    </div>
  );
}
