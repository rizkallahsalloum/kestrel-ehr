import type { ReactNode } from "react";
import { Badge, CheckCircleIcon, cn, PrivateText, SeverityTag, severityIcons, severityOutline } from "@/components/ui";
import { medicationLabel } from "@/features/chart/alerts";
import { formatDate, formatDateTime } from "@/lib/format";
import type { Prescription, PrescriptionAlert } from "@/types/domain";
import { sigSentence } from "../sig";
import { orderAlerts } from "../workspace";

function supplyText(rx: Prescription): string {
  const parts = [`${rx.quantity} dispensed`, `${rx.refills} refill${rx.refills === 1 ? "" : "s"}`];
  if (rx.duration_days) parts.push(`${rx.duration_days} days`);
  return parts.join(", ");
}

/** The saved version as one block (E-Rx `.rx` with `.kv`). Prescription details are private values. */
export function PrescriptionSummary({
  prescription: rx,
  prescriberName,
  headingLevel = 3,
}: {
  prescription: Prescription;
  prescriberName: string | null;
  headingLevel?: 2 | 3;
}) {
  const Heading = headingLevel === 2 ? "h2" : "h3";
  const rows: [label: string, value: string, isPrivate: boolean][] = [
    ["Directions", sigSentence({ doseAmount: rx.dose_amount, doseUnit: rx.dose_unit, route: rx.route, frequency: rx.frequency }) ?? "Incomplete", true],
    ["Supply", supplyText(rx), true],
    ["Start date", formatDate(rx.start_date), true],
    ["Instructions", rx.instructions ?? "None", true],
    ["Prescriber", prescriberName ?? "Unknown", false],
    ["Version", String(rx.version), false],
  ];
  if (rx.signed_at) rows.push(["Signed", formatDateTime(rx.signed_at), false]);
  if (rx.cancelled_at) {
    rows.push(["Cancelled", formatDateTime(rx.cancelled_at), false]);
    if (rx.cancel_reason) rows.push(["Cancel reason", rx.cancel_reason, true]);
  }

  return (
    <div className="rounded-panel bg-surface-warm px-4 py-3.5">
      <Heading className="text-heading-md font-semibold text-ink">
        <PrivateText label="Medication">{medicationLabel(rx)}</PrivateText>
      </Heading>
      <p className="font-mono text-code-sm text-ink-strong">
        <PrivateText label="Drug class">{rx.medication?.drug_class_code}</PrivateText> · synthetic catalog
      </p>
      <dl
        aria-label="Prescription summary"
        className="mt-2.5 grid grid-cols-key-value gap-x-2.5 gap-y-1.5 border-t border-line-subtle pt-2.5 text-body-sm"
      >
        {rows.map(([label, value, isPrivate]) => (
          <div key={label} className="contents">
            <dt className="text-ink-strong">{label}</dt>
            <dd className="font-medium break-words text-ink">
              {isPrivate ? (
                <PrivateText label={label} block>
                  {value}
                </PrivateText>
              ) : (
                value
              )}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/**
 * Safety decision cards (E-Rx `.iss`), blocking first. Blocking: orange with the emphasis outline and
 * circle icon, no resolution, guidance and a link to the medication section. Advisory: orange with a
 * hairline outline and triangle icon until acknowledged, then a neutral record. No undo.
 * Alert text stays visible in Privacy mode (safety information); only the clinician's note is private.
 */
export function SafetyDecisionList({
  alerts,
  medicationHref,
  renderAcknowledge,
}: {
  alerts: PrescriptionAlert[];
  /** Link target for changing the medication; omitted on read-only views. */
  medicationHref?: string;
  renderAcknowledge?: (alert: PrescriptionAlert) => ReactNode;
}) {
  return (
    <ul className="flex flex-col gap-2" aria-label="Safety alerts">
      {orderAlerts(alerts).map((alert) => {
        const blocking = alert.severity === "blocking";
        const done = !blocking && Boolean(alert.decision);
        const Icon = severityIcons[blocking ? "critical" : "warning"];
        return (
          <li
            key={alert.id}
            className={cn(
              "rounded-panel px-3.5 py-3",
              blocking
                ? `${severityOutline.critical} bg-warning-subtle`
                : done
                  ? "border border-line-subtle bg-surface"
                  : `${severityOutline.warning} bg-warning-subtle`,
            )}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p
                className={cn("flex items-center gap-1.5 text-label font-semibold", done ? "text-ink" : "text-warning")}
              >
                {done ? <CheckCircleIcon className="text-ok" /> : <Icon />}
                <SeverityTag severity={blocking ? "critical" : "warning"}>{blocking ? "Blocking" : "Advisory"}</SeverityTag>
              </p>
              {done && <Badge tone="ok">Acknowledged</Badge>}
            </div>
            <p className={cn("mt-1.5 text-body-sm", done ? "text-ink-strong" : "font-medium text-ink")}>{alert.message}</p>
            {blocking && (
              <p className="mt-1.5 text-label-sm text-ink-strong">
                Blocking alerts cannot be overridden. Change the medication or cancel the draft.
                {medicationHref && (
                  <>
                    {" "}
                    <a href={medicationHref} className="font-semibold text-accent underline underline-offset-2">
                      Go to medication
                    </a>
                  </>
                )}
              </p>
            )}
            {done && alert.decision && (
              <p className="mt-1 text-label-sm text-ink-strong">
                {alert.decision.reason ? (
                  <>
                    Note: <PrivateText label="Acknowledgement note">{alert.decision.reason}</PrivateText>
                  </>
                ) : (
                  "No note recorded."
                )}{" "}
                Recorded {formatDateTime(alert.decision.created_at)}.
              </p>
            )}
            {!blocking && !alert.decision && renderAcknowledge?.(alert)}
          </li>
        );
      })}
    </ul>
  );
}
