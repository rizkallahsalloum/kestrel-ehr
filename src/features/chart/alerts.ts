import type { DraftAlertRow, PrescriptionListItem } from "@/types/domain";

export type DraftSafetyState =
  | { kind: "unchecked" }
  | { kind: "checked"; blocking: number; advisoryPending: number; messages: string[] };

export type DraftAlertSummary = {
  prescriptionId: string;
  medicationLabel: string;
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
      medicationLabel: medicationLabel(rx),
      blocking: state.blocking,
      advisoryPending: state.advisoryPending,
      messages: state.messages,
    });
  }
  return summaries.sort((a, b) => Number(b.blocking > 0) - Number(a.blocking > 0));
}

/** Drafts whose saved version has not been through the safety check. */
export function countUncheckedDrafts(prescriptions: PrescriptionListItem[]): number {
  return prescriptions.filter((rx) => draftSafetyState(rx, [])?.kind === "unchecked").length;
}
