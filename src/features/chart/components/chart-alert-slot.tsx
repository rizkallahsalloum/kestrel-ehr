import Link from "next/link";
import { AlertBanner, buttonStyles, InfoIcon, NoAlert } from "@/components/ui";
import { blockingBannerTitle, type DraftAlertSummary } from "@/features/chart/alerts";
import { prescriptionPath } from "@/features/patients/refs";

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

function bannerTitle(summary: DraftAlertSummary, now: Date): string {
  if (summary.blocking > 0) return blockingBannerTitle(summary.createdAt, now);
  return `Advisory demo alert to acknowledge on draft: ${summary.medicationLabel}`;
}

function bannerCounts(summary: DraftAlertSummary): string {
  const parts: string[] = [];
  if (summary.blocking > 0) parts.push(`${plural(summary.blocking, "blocking alert")} (change the draft or cancel it)`);
  if (summary.advisoryPending > 0) parts.push(`${plural(summary.advisoryPending, "advisory alert")} to acknowledge`);
  return `${parts.join(" and ")}.`;
}

/**
 * Dashboard alert slot. Shows drafts whose current, evaluated version still has blocking alerts or
 * unacknowledged advisories. Acknowledging happens in the prescribing workspace, one alert at a
 * time, so the banner only links there.
 */
export function ChartAlertSlot({
  patientRef,
  summaries,
  uncheckedDrafts,
}: {
  patientRef: string;
  summaries: DraftAlertSummary[];
  uncheckedDrafts: number;
}) {
  // Server-rendered only, so "today" is decided once per request and never re-evaluated in the browser.
  const now = new Date();
  return (
    <section aria-labelledby="chart-alerts-heading" className="flex flex-col gap-3">
      <h2 id="chart-alerts-heading" className="sr-only">
        Demo safety alerts
      </h2>
      {summaries.map((summary) => (
        <AlertBanner
          key={summary.prescriptionId}
          tone={summary.blocking > 0 ? "critical" : "warning"}
          title={bannerTitle(summary, now)}
          actions={
            <Link
              href={prescriptionPath(patientRef, summary.prescriptionRef)}
              className={buttonStyles({ size: "sm" })}
            >
              Review draft<span className="sr-only"> for {summary.medicationLabel}</span>
            </Link>
          }
        >
          <p>
            {summary.blocking > 0 && `Draft: ${summary.medicationLabel}. `}
            {bannerCounts(summary)}
          </p>
          <ul className="mt-1 list-disc pl-5">
            {summary.messages.map((message, i) => (
              <li key={i}>{message}</li>
            ))}
          </ul>
        </AlertBanner>
      ))}
      {summaries.length === 0 && <NoAlert>No unresolved demo safety alerts on this patient&apos;s drafts.</NoAlert>}
      {uncheckedDrafts > 0 && (
        <NoAlert icon={<InfoIcon className="text-ink-muted" />}>
          {uncheckedDrafts === 1 ? "1 draft has" : `${uncheckedDrafts} drafts have`} not had a safety check on the
          saved version. Open the draft to run it.
        </NoAlert>
      )}
    </section>
  );
}
