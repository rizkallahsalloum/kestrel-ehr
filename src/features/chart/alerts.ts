import type { DraftAlertRow, PrescriptionListItem } from "@/types/domain";

export type DraftSafetyState =
  | { kind: "unchecked" }
  | { kind: "checked"; blocking: number; advisoryPending: number; messages: string[] };

export type DraftAlertSummary = {
  prescriptionId: string;
  prescriptionRef: string;
  medicationLabel: string;
  /** The draft's `created_at`: the day the order was placed. Edits do not move it. */
  createdAt: string;
  blocking: number;
  advisoryPending: number;
  /** Messages of the alerts still needing action, blocking first. */
  messages: string[];
};

export function medicationLabel(rx: Pick<PrescriptionListItem, "medication">): string {
  const m = rx.medication;
  return m ? [m.name, m.strength, m.form].filter(Boolean).join(" ") : "Unknown medication";
}

/**
 * Safety state of one draft. Alerts only count when the saved version has been evaluated and the
 * alert belongs to that version; anything else would describe a version that can no longer be signed.
 * Mirrors getSignReadiness for display only; the database decides whether a draft can be signed.
 */
export function draftSafetyState(
  rx: Pick<PrescriptionListItem, "id" | "status" | "version" | "last_evaluated_version">,
  alerts: DraftAlertRow[],
): DraftSafetyState | null {
  if (rx.status !== "draft") return null;
  if (rx.last_evaluated_version !== rx.version) return { kind: "unchecked" };
  const current = alerts.filter((a) => a.prescription_id === rx.id && a.prescription_version === rx.version);
  const blocking = current.filter((a) => a.severity === "blocking");
  const pending = current.filter((a) => a.severity === "advisory" && !a.decision);
  return {
    kind: "checked",
    blocking: blocking.length,
    advisoryPending: pending.length,
    messages: [...blocking, ...pending].map((a) => a.message),
  };
}

/** Drafts with blocking alerts or unacknowledged advisories on their current version, most severe first. */
export function summarizeDraftAlerts(prescriptions: PrescriptionListItem[], alerts: DraftAlertRow[]): DraftAlertSummary[] {
  const summaries: DraftAlertSummary[] = [];
  for (const rx of prescriptions) {
    const state = draftSafetyState(rx, alerts);
    if (state?.kind !== "checked" || state.blocking + state.advisoryPending === 0) continue;
    summaries.push({
      prescriptionId: rx.id,
      prescriptionRef: rx.public_ref,
      medicationLabel: medicationLabel(rx),
      createdAt: rx.created_at,
      blocking: state.blocking,
      advisoryPending: state.advisoryPending,
      messages: state.messages,
    });
  }
  return summaries.sort((a, b) => Number(b.blocking > 0) - Number(a.blocking > 0));
}

/** Calendar day (YYYY-MM-DD) in UTC, the zone every date in the app is shown in (`lib/format.ts`). */
export function utcDay(value: string | Date): string {
  return new Date(value).toISOString().slice(0, 10);
}

/**
 * Title of a chart banner for a draft with a blocking alert: "today's order" when the draft was
 * created on the same UTC day as `now`, otherwise "pending order".
 * Every blocking alert is currently an allergy rule (DEMO-R001, DEMO-R002); a future non-allergy
 * blocking rule needs its own title.
 */
export function blockingBannerTitle(createdAt: string, now: Date): string {
  return utcDay(createdAt) === utcDay(now) ? "Allergy conflict on today's order" : "Allergy conflict on pending order";
}

/** Drafts whose saved version has not been through the safety check. */
export function countUncheckedDrafts(prescriptions: PrescriptionListItem[]): number {
  return prescriptions.filter((rx) => draftSafetyState(rx, [])?.kind === "unchecked").length;
}
