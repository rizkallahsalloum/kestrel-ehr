import Link from "next/link";
import { Avatar, cn, PrivateText, StatusDot } from "@/components/ui";
import { getInitials } from "@/lib/initials";
import { QUEUE_STATUS_LABEL, type QueuePatient } from "../queue";

export const queueChipClass =
  "inline-flex min-h-control-sm shrink-0 items-center gap-2 rounded-pill border py-1 pr-3 pl-1 text-label-sm whitespace-nowrap transition-colors";

/**
 * One chip in Today's queue: initials, name and status dot, linking to the chart. The status is in
 * the accessible name, not colour alone. With Privacy mode on, name and initials are masked and
 * `maskedLabel` ("Patient 2 of 4, name hidden, Warning") keeps the links distinguishable.
 */
export function PatientQueueItem({
  patient,
  current,
  maskedLabel,
}: {
  patient: QueuePatient;
  /** "page" on the patient's chart, true on the patient's deeper pages (prescriptions). */
  current?: "page" | true;
  maskedLabel?: string;
}) {
  const status = QUEUE_STATUS_LABEL[patient.status];
  return (
    <Link
      href={`/patients/${patient.id}`}
      aria-current={current}
      aria-label={maskedLabel}
      data-queue-item={patient.id}
      className={cn(
        queueChipClass,
        current
          ? "border-accent bg-accent-subtle font-medium text-ink"
          : "border-line-subtle bg-surface text-ink-strong hover:border-line",
      )}
    >
      <Avatar
        size="xs"
        tone="teal"
        initials={
          <PrivateText label="Initials" revealable={false} mask="••">
            {getInitials(`${patient.givenName} ${patient.familyName}`)}
          </PrivateText>
        }
      />
      <PrivateText label="Patient name" revealable={false}>{`${patient.givenName} ${patient.familyName}`}</PrivateText>
      <StatusDot tone={patient.status} label={`, ${status}`} />
    </Link>
  );
}
