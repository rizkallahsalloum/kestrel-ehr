import type { AvatarTone } from "@/components/ui";
import type { AlertSeverity, PrescriptionStatus } from "@/types/domain";

/** Status dot of a queue chip: red, orange or green, always with `QUEUE_STATUS_LABEL` text. */
export type QueueStatus = "critical" | "warning" | "stable";

export type QueuePatient = { id: string; givenName: string; familyName: string; status: QueueStatus };

export type QueueDraftRow = {
  status: PrescriptionStatus;
  version: number;
  last_evaluated_version: number | null;
  prescription_alerts: { prescription_version: number; severity: AlertSeverity; decision: { id: string } | null }[];
};

export type QueuePatientRow = {
  id: string;
  given_name: string;
  family_name: string;
  prescriptions: QueueDraftRow[];
};

/** Chips shown in the top bar; a "View all" chip follows when there are more. */
export const QUEUE_LIMIT = 6;

export const QUEUE_STATUS_LABEL: Record<QueueStatus, string> = {
  critical: "Critical alert",
  warning: "Warning",
  stable: "No alerts",
};

const RANK: Record<QueueStatus, number> = { critical: 0, warning: 1, stable: 2 };

/**
 * Inputs to a patient's queue status. Drafts only today; Phase 9 vitals can add a field here and a
 * case in `queueStatus` without changing the queue components.
 */
export type QueueSignals = { drafts: QueueDraftRow[] };

/**
 * The one mapping from clinical signals to a queue status. Unresolved alerts only (the query filters
 * resolved ones); a severe allergy on its own changes nothing.
 * - critical: a draft has a blocking alert on its current, checked version;
 * - warning: a draft has an advisory alert without a decision on its current, checked version, or
 *   its saved version has not been safety-checked;
 * - stable: neither.
 */
export function queueStatus({ drafts }: QueueSignals): QueueStatus {
  let status: QueueStatus = "stable";
  for (const rx of drafts) {
    if (rx.status !== "draft") continue;
    if (rx.last_evaluated_version !== rx.version) {
      status = "warning";
      continue;
    }
    for (const alert of rx.prescription_alerts) {
      if (alert.prescription_version !== rx.version) continue;
      if (alert.severity === "blocking") return "critical";
      if (alert.severity === "advisory" && !alert.decision) status = "warning";
    }
  }
  return status;
}

/** Highest alert severity first, then family name, then given name. */
export function orderQueue(patients: QueuePatient[]): QueuePatient[] {
  const collator = new Intl.Collator(undefined, { sensitivity: "base" });
  return [...patients].sort(
    (a, b) =>
      RANK[a.status] - RANK[b.status] ||
      collator.compare(a.familyName, b.familyName) ||
      collator.compare(a.givenName, b.givenName),
  );
}

export function buildQueue(rows: QueuePatientRow[]): QueuePatient[] {
  return orderQueue(
    rows.map((row) => ({
      id: row.id,
      givenName: row.given_name,
      familyName: row.family_name,
      status: queueStatus({ drafts: row.prescriptions }),
    })),
  );
}

/**
 * Items in the queue row: chips plus "View all" when there are more than `QUEUE_LIMIT` patients.
 * "Queue unavailable" takes one item's place. Feeds the top-bar height (`data-queue-items`).
 */
export function queueItemCount(queue: QueuePatient[] | null): number {
  if (queue === null) return 1;
  return Math.min(queue.length, QUEUE_LIMIT) + (queue.length > QUEUE_LIMIT ? 1 : 0);
}

/** Chip avatar palette slots, in assignment order (colours in `--color-queue-avatar-*`). */
export const QUEUE_AVATAR_TONES = ["queue-1", "queue-2", "queue-3"] as const satisfies readonly AvatarTone[];

export type QueueAvatarTone = (typeof QUEUE_AVATAR_TONES)[number];

/**
 * Decorative avatar colour per queue patient, keyed by id. Pass every queue patient, not only the
 * chips shown, so a colour does not change when someone moves in or out of the visible six. Ids are
 * sorted and the index mod 3 picks the slot, so the colour ignores alert ordering. One patient gets
 * the first slot (teal). The colour carries no meaning; status is the dot and its text.
 */
export function queueAvatarTones(patients: readonly Pick<QueuePatient, "id">[]): Map<string, QueueAvatarTone> {
  const ids = [...new Set(patients.map((p) => p.id))].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  return new Map(ids.map((id, index) => [id, QUEUE_AVATAR_TONES[index % QUEUE_AVATAR_TONES.length]!]));
}