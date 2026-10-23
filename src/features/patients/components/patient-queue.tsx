"use client"; // Marks the current patient from the URL and names masked chips from Privacy mode state.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/components/ui";
import { usePrivacy } from "@/features/privacy/components/privacy-provider";
import { QUEUE_LIMIT, QUEUE_STATUS_LABEL, queueAvatarTones, type QueuePatient } from "../queue";
import { patientPath } from "../refs";
import { PatientQueueItem, queueChipClass } from "./patient-queue-item";

/** "page" on the chart itself, true on the patient's deeper pages, so the chip shows where you are. */
function currentFor(pathname: string, patientRef: string): "page" | true | undefined {
  const chart = patientPath(patientRef);
  if (pathname === chart) return "page";
  return pathname.startsWith(`${chart}/`) ? true : undefined;
}

/**
 * Today's queue (dashboard `.queue`): up to `QUEUE_LIMIT` chips, most urgent first, then "View all"
 * when there are more. Lives in the top bar's `queue` grid area: its own row under the search and
 * controls, chips in `--queue-cols` columns that wrap onto more lines (never sideways scrolling).
 * From `queue-inline-N` (N items) the queue sits on the search row instead, in N columns. The top bar's height, and every
 * sticky offset, follows from the item count (see `--topbar-height` in globals.css).
 */
export function PatientQueue({
  queue,
  viewAllHref = "/patients",
  activePath,
}: {
  /** `null` when the queue could not be loaded. */
  queue: QueuePatient[] | null;
  viewAllHref?: string;
  activePath?: string;
}) {
  const pathname = usePathname();
  const { on: masked } = usePrivacy();
  if (queue?.length === 0) return null;
  const current = activePath ?? pathname;
  const shown = queue?.slice(0, QUEUE_LIMIT) ?? [];
  // From the whole queue, so a colour stays put when a patient enters or leaves the visible six.
  const tones = queueAvatarTones(queue ?? []);
  return (
    <nav
      aria-label="Today's queue"
      data-queue=""
      className="flex min-w-0 items-start gap-md pt-queue area-queue"
    >
      <span
        aria-hidden="true"
        className="hidden h-control-sm shrink-0 items-center label-caps md:flex"
      >
        Today&apos;s queue
      </span>
      {queue === null ? (
        <p className="flex h-control-sm items-center text-label-sm text-ink-muted">Queue unavailable</p>
      ) : (
        <ul className="grid min-w-0 flex-1 grid-cols-queue auto-rows-(--spacing-control-sm) gap-2">
          {shown.map((patient, index) => (
            <li key={patient.id} className="min-w-0 max-w-queue-chip">
              <PatientQueueItem
                patient={patient}
                avatarTone={tones.get(patient.id)}
                current={currentFor(current, patient.ref)}
                maskedLabel={
                  masked
                    ? `Patient ${index + 1} of ${shown.length}, name hidden, ${QUEUE_STATUS_LABEL[patient.status]}`
                    : undefined
                }
              />
            </li>
          ))}
          {queue.length > shown.length && (
            <li className="min-w-0">
              <Link
                href={viewAllHref}
                className={cn(queueChipClass, "border-line-subtle bg-surface pl-3 text-accent hover:border-line")}
              >
                View all <span className="font-mono text-ink-muted">{queue.length}</span>
                <span className="sr-only-inline"> patients</span>
              </Link>
            </li>
          )}
        </ul>
      )}
    </nav>
  );
}
