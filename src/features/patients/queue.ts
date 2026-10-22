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
 * Critical when a draft has a blocking alert on its evaluated current version, warning when one has
 * an unacknowledged advisory, stable otherwise. Same counting rule as `draftSafetyState`; drafts
 * whose current version has not been checked count as stable. Unresolved alerts only.
 */
export function queueStatus(drafts: QueueDraftRow[]): QueueStatus {
  let status: QueueStatus = "stable";
  for (const rx of drafts) {
    if (rx.status !== "draft" || rx.last_evaluated_version !== rx.version) continue;
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
      status: queueStatus(row.prescriptions),
    })),
  );
}
