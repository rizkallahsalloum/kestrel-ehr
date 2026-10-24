import type { PrescriptionAlert, PrescriptionStatus } from "@/types/domain";
import type { PrescriptionFormValues } from "./form-values";
import { prescriptionContentSchema } from "./schemas";
import type { SignReadiness } from "./transitions";

export type AlertCounts = { blocking: number; advisoryPending: number; acknowledged: number };

export function countAlerts(alerts: Pick<PrescriptionAlert, "severity" | "decision">[]): AlertCounts {
  return {
    blocking: alerts.filter((a) => a.severity === "blocking").length,
    advisoryPending: alerts.filter((a) => a.severity === "advisory" && !a.decision).length,
    acknowledged: alerts.filter((a) => a.severity === "advisory" && a.decision).length,
  };
}

function alertRank(alert: Pick<PrescriptionAlert, "severity" | "decision">): number {
  if (alert.severity === "blocking") return 0;
  return alert.decision ? 2 : 1;
}

/** Blocking first, then advisories still to acknowledge, then acknowledged ones; stable within each group. */
export function orderAlerts<T extends Pick<PrescriptionAlert, "severity" | "decision">>(alerts: T[]): T[] {
  return [...alerts].sort((a, b) => alertRank(a) - alertRank(b));
}

/** Safety state of the saved version, as shown in the left column and the review header. */
export type SafetyState =
  | { kind: "unsaved" }
  | { kind: "unchecked" }
  | ({ kind: "checked" } & AlertCounts);

export function safetyState(
  rx: { version: number; last_evaluated_version: number | null } | null,
  alerts: Pick<PrescriptionAlert, "severity" | "decision">[],
): SafetyState {
  if (!rx) return { kind: "unsaved" };
  if (rx.last_evaluated_version !== rx.version) return { kind: "unchecked" };
  return { kind: "checked", ...countAlerts(alerts) };
}

/**
 * Page-level outcome text. It changes exactly when a save, sign or cancel lands, so the live
 * region announces it after the refresh. Fixed wording: no medication or patient details.
 */
export function outcomeMessage(rx: { status: PrescriptionStatus; version: number }): string {
  if (rx.status === "signed") return "Prescription signed (simulated).";
  if (rx.status === "cancelled") return "Draft cancelled.";
  return `Draft saved as version ${rx.version}.`;
}

/** Advisory progress on the saved version; it changes when an alert is acknowledged. */
export function acknowledgementSummary(counts: AlertCounts): string {
  return `${counts.blocking + counts.advisoryPending} open, ${counts.acknowledged} acknowledged`;
}

export function isDirty(values: PrescriptionFormValues, saved: PrescriptionFormValues): boolean {
  return (Object.keys(saved) as (keyof PrescriptionFormValues)[]).some((key) => values[key] !== saved[key]);
}

const supplySchema = prescriptionContentSchema.pick({
  doseAmount: true,
  doseUnit: true,
  route: true,
  frequency: true,
  quantity: true,
  refills: true,
  durationDays: true,
  startDate: true,
});

/** `shortLabel` is shown when the tracker is too narrow for `label`; the accessible name is always `label`. */
export type TrackerStep = { id: string; label: string; shortLabel?: string; done: boolean };

/** Section tracker: medication chosen, directions and supply valid, saved version under review. */
export function trackerSteps(
  values: PrescriptionFormValues,
  catalogIds: readonly string[],
  reviewCurrent: boolean,
): TrackerStep[] {
  return [
    { id: "rx-medication", label: "Medication", done: catalogIds.includes(values.medicationId) },
    { id: "rx-directions", label: "Directions and supply", shortLabel: "Directions", done: supplySchema.safeParse(values).success },
    { id: "rx-review", label: "Review", done: reviewCurrent },
  ];
}

/** Sign button label: the first thing still missing, then the final action. */
export function signButtonLabel(input: {
  readiness: SignReadiness;
  counts: AlertCounts;
  evaluated: boolean;
  dirty: boolean;
  attested: boolean;
}): string {
  const { counts } = input;
  if (input.dirty) return "Save your changes to sign";
  if (!input.evaluated) return "Run the safety check to sign";
  if (counts.blocking > 0) return "Blocking alert: change or cancel the draft";
  if (counts.advisoryPending > 0) {
    return `Acknowledge ${counts.advisoryPending} advisory alert${counts.advisoryPending === 1 ? "" : "s"} to sign`;
  }
  if (!input.readiness.canSign) return "Signing is not available";
  if (!input.attested) return "Confirm the review to sign";
  return "Sign prescription (simulated)";
}
