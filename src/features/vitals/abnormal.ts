import { VITAL_KINDS, VITAL_RULES, vitalStatus, type VitalKind, type VitalReading, type VitalRule } from "./thresholds";

export type AbnormalVital = {
  kind: VitalKind;
  status: VitalRule["status"];
  /** The DEMO-V rule that put the vital in this band. */
  rule: VitalRule;
};

function ruleFor(kind: VitalKind, status: VitalRule["status"]): VitalRule {
  const rule = VITAL_RULES.find((r) => r.vital === kind && r.status === status);
  if (!rule) throw new Error(`No demo vitals rule for ${kind} ${status}`);
  return rule;
}

/**
 * Vitals of one reading outside the demo stable band, critical first, then in band order
 * (heart rate, blood pressure, SpO₂, temperature). Empty when every vital is stable.
 */
export function abnormalVitals(reading: VitalReading): AbnormalVital[] {
  const found: AbnormalVital[] = [];
  for (const kind of VITAL_KINDS) {
    const status = vitalStatus(kind, reading);
    if (status !== "stable") found.push({ kind, status, rule: ruleFor(kind, status) });
  }
  return found.sort((a, b) => Number(b.status === "critical") - Number(a.status === "critical"));
}
