import type { AlertSeverity, PrescriptionStatus } from "@/types/domain";

/**
 * Mirror of the lifecycle enforced by private.prescriptions_guard and the
 * prescription functions. Used for UI gating only; the database is authoritative.
 */
export const PRESCRIPTION_TRANSITIONS: Record<PrescriptionStatus, readonly PrescriptionStatus[]> = {
  draft: ["signed", "cancelled"],
  signed: [],
  cancelled: [],
};

export function canTransition(from: PrescriptionStatus, to: PrescriptionStatus): boolean {
  return PRESCRIPTION_TRANSITIONS[from].includes(to);
}

export function isEditable(status: PrescriptionStatus): boolean {
  return status === "draft";
}

export type ReadinessAlert = { severity: AlertSeverity; acknowledged: boolean };

export type SignReadiness = { canSign: boolean; reasons: string[] };

export function getSignReadiness(input: {
  status: PrescriptionStatus;
  version: number;
  lastEvaluatedVersion: number | null;
  alerts: ReadinessAlert[];
}): SignReadiness {
  const reasons: string[] = [];
  if (!canTransition(input.status, "signed")) {
    reasons.push(`A ${input.status} prescription cannot be signed.`);
    return { canSign: false, reasons };
  }
  if (input.lastEvaluatedVersion !== input.version) {
    reasons.push("Run the safety check for the current version of this draft.");
  }
  const blocking = input.alerts.filter((a) => a.severity === "blocking").length;
  if (blocking > 0) {
    reasons.push(`${blocking} blocking demo alert${blocking === 1 ? "" : "s"} must be resolved by changing the draft.`);
  }
  const pending = input.alerts.filter((a) => a.severity === "advisory" && !a.acknowledged).length;
  if (pending > 0) {
    reasons.push(`${pending} advisory demo alert${pending === 1 ? "" : "s"} must be acknowledged.`);
  }
  return { canSign: reasons.length === 0, reasons };
}
