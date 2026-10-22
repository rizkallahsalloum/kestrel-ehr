"use client"; // Marks the current patient from the URL and names masked chips from Privacy mode state.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/components/ui";
import { usePrivacy } from "@/features/privacy/components/privacy-provider";
import { QUEUE_LIMIT, QUEUE_STATUS_LABEL, type QueuePatient } from "../queue";
import { PatientQueueItem, queueChipClass } from "./patient-queue-item";

/** "page" on the chart itself, true on the patient's deeper pages, so the chip shows where you are. */
function currentFor(pathname: string, patientId: string): "page" | true | undefined {
  const chart = `/patients/${patientId}`;
  if (pathname === chart) return "page";
  return pathname.startsWith(`${chart}/`) ? true : undefined;
}

/**
 * Today's queue (dashboard `.queue`): up to `QUEUE_LIMIT` chips, most urgent first, then "View all"
 * when there are more. `layout="bar"` sits in the top bar from 761px; `layout="row"` is the
 * horizontally scrolling row under the top bar at 760px and below.
 */
export function PatientQueue({
  queue,
  layout,
  viewAllHref = "/patients",
  activePath,
}: {
  /** `null` when the queue could not be loaded. */
  queue: QueuePatient[] | null;
  layout: "bar" | "row";
  viewAllHref?: string;
  activePath?: string;
}) {
  const pathname = usePathname();
  const { on: masked } = usePrivacy();
  if (queue?.length === 0) return null;
  const current = activePath ?? pathname;
  const shown = queue?.slice(0, QUEUE_LIMIT) ?? [];
  return (
    <nav
      aria-label="Today's queue"
      data-queue={layout}
      className={cn(
        "min-w-0 items-center gap-2",
        layout === "bar"
          ? "hidden flex-1 md:flex"
          : "flex border-b border-line-subtle bg-page px-4 py-2.5 md:hidden",
      )}
    >
      <span aria-hidden="true" className={cn("label-caps shrink-0", layout === "bar" ? "hidden xl:inline" : "hidden")}>
        Today&apos;s queue
      </span>
      {queue === null && <p className="text-label-sm text-ink-muted">Queue unavailable</p>}
      {/* `relative`: the chips' sr-only labels are absolutely positioned and must be clipped by this scroller. */}
      <ul className="relative flex min-w-0 flex-1 items-center gap-2 scrollbar-none overflow-x-auto p-0.5">
        {shown.map((patient, index) => (
          <li key={patient.id} className="shrink-0">
            <PatientQueueItem
              patient={patient}
              current={currentFor(current, patient.id)}
              maskedLabel={
                masked
                  ? `Patient ${index + 1} of ${shown.length}, name hidden, ${QUEUE_STATUS_LABEL[patient.status]}`
                  : undefined
              }
            />
          </li>
        ))}
        {queue && queue.length > shown.length && (
          <li className="shrink-0">
            <Link
              href={viewAllHref}
              className={cn(queueChipClass, "border-line-subtle bg-surface pl-3 text-accent hover:border-line")}
            >
              View all <span className="font-mono text-ink-muted">{queue.length}</span>
              <span className="sr-only"> patients</span>
            </Link>
          </li>
        )}
      </ul>
    </nav>
  );
}
