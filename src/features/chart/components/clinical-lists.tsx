import Link from "next/link";
import type { ReactNode } from "react";
import {
  Badge,
  buttonStyles,
  Card,
  cn,
  EmptyState,
  PanelTitle,
  PillIcon,
  SeverityTag,
  severityIcons,
  severityOutline,
  type Tone,
} from "@/components/ui";
import { allergyTone, bySeverity, highestSeverity } from "@/features/chart/allergies";
import { draftSafetyState, medicationLabel } from "@/features/chart/alerts";
import { formatDate, formatDateTime } from "@/lib/format";
import type { Allergy, DraftAlertRow, PatientMedication, PrescriptionListItem, PrescriptionStatus } from "@/types/domain";

const SEVERITY_LABEL = { severe: "Severe", moderate: "Moderate", mild: "Mild" } as const;

type PanelTone = "default" | "warning" | "critical";

/** Card outline: the blocking tone adds the emphasis width. */
const panelOutlines: Record<PanelTone, string> = {
  default: "border border-line-subtle",
  ...severityOutline,
};

/** Row dividers stay hairline in every tone. */
const panelDividers: Record<PanelTone, string> = {
  default: "border-line-subtle",
  warning: "border-warning-line",
  critical: "border-warning-line",
};

/** Dashboard context-column card: flush rows under an icon-led title. */
function Panel({
  title,
  icon,
  tone = "default",
  children,
}: {
  title: string;
  icon: ReactNode;
  tone?: PanelTone;
  children: ReactNode;
}) {
  return (
    <section className={cn("rounded-card bg-surface shadow-level-1", panelOutlines[tone])}>
      <div className="px-5 pt-4 pb-3">
        <PanelTitle as="h2" icon={icon} tone={tone}>
          {title}
        </PanelTitle>
      </div>
      {children}
    </section>
  );
}

export function AllergyPanel({ allergies }: { allergies: Allergy[] }) {
  const highest = highestSeverity(allergies);
  const tone: PanelTone = highest ? allergyTone(highest) : "default";
  const Icon = tone === "critical" ? severityIcons.critical : severityIcons.warning;
  return (
    <Panel title="Allergies" icon={<Icon className="size-3.75" />} tone={tone}>
      {highest ? (
        <ul aria-label="Active allergies" className="pb-1">
          {bySeverity(allergies).map((allergy) => {
            const rowTone = allergyTone(allergy.severity);
            return (
              <li
                key={allergy.id}
                className={cn(
                  "flex items-start justify-between gap-2.5 border-t px-5 py-2.75 first:border-t-0",
                  panelDividers[tone],
                )}
              >
                <div className="min-w-0">
                  <p className="text-label font-semibold text-warning">{allergy.substance_text}</p>
                  {allergy.reaction && <p className="mt-0.5 text-label-sm text-ink-strong">{allergy.reaction}</p>}
                  {allergy.drug_class_code && (
                    <p className="mt-0.5 font-mono text-code-sm text-ink-muted">{allergy.drug_class_code}</p>
                  )}
                </div>
                <SeverityTag severity={rowTone}>{SEVERITY_LABEL[allergy.severity]}</SeverityTag>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="px-5 pt-0 pb-4.5 text-label text-ink-muted">No active allergies recorded.</p>
      )}
    </Panel>
  );
}

export function MedicationPanel({ medications }: { medications: PatientMedication[] }) {
  return (
    <Panel title="Active medications" icon={<PillIcon className="size-3.75" />}>
      {medications.length > 0 ? (
        <ul aria-label="Active medications" className="pb-1">
          {medications.map((item) => (
            <li key={item.id} className="border-t border-line-subtle px-5 py-3.25 first:border-t-0">
              <p className="text-label font-semibold text-ink">{medicationLabel(item)}</p>
              <p className="mt-0.5 font-mono text-code-sm text-ink-muted">
                {item.dose_text} · since {formatDate(item.start_date)}
              </p>
              {item.source_prescription_id && <Badge tone="accent" className="mt-1.5">from signed prescription</Badge>}
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-5 pt-0 pb-4.5 text-label text-ink-muted">No active medications recorded.</p>
      )}
    </Panel>
  );
}

export const prescriptionStatusTone: Record<PrescriptionStatus, Tone> = {
  draft: "neutral",
  signed: "ok",
  cancelled: "neutral",
};

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

function statusNote(rx: PrescriptionListItem, alerts: DraftAlertRow[]): string | null {
  if (rx.status === "signed" && rx.signed_at) return `Signed ${formatDateTime(rx.signed_at)}`;
  const state = draftSafetyState(rx, alerts);
  if (!state) return null;
  if (state.kind === "unchecked") return "Safety check not run";
  if (state.blocking > 0) return plural(state.blocking, "blocking alert");
  if (state.advisoryPending > 0) return `${plural(state.advisoryPending, "advisory alert")} to acknowledge`;
  return "No open demo alerts";
}

export function PrescriptionsCard({
  patientId,
  prescriptions,
  draftAlerts,
}: {
  patientId: string;
  prescriptions: PrescriptionListItem[];
  draftAlerts: DraftAlertRow[];
}) {
  return (
    <Card
      elevated
      title="Prescriptions"
      description="Demo prescriptions for this patient. Signing is simulated and nothing is transmitted."
      actions={
        <Link href={`/patients/${patientId}/prescriptions/new`} className={buttonStyles({ size: "sm" })}>
          New prescription draft
        </Link>
      }
    >
      {prescriptions.length === 0 ? (
        <EmptyState>No prescriptions yet.</EmptyState>
      ) : (
        <table className="w-full text-left text-body-sm" aria-label="Prescriptions">
          <thead>
            <tr>
              <th scope="col" className="label-caps pr-4 pb-2">Medication</th>
              <th scope="col" className="label-caps hidden pr-4 pb-2 md:table-cell">Quantity</th>
              <th scope="col" className="label-caps hidden pr-4 pb-2 md:table-cell">Start date</th>
              <th scope="col" className="label-caps pb-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {prescriptions.map((rx) => {
              const note = statusNote(rx, draftAlerts);
              return (
                <tr key={rx.id} className="border-t border-line-subtle align-top">
                  <td className="py-3 pr-4">
                    <Link
                      href={`/patients/${patientId}/prescriptions/${rx.id}`}
                      className="font-medium text-accent underline-offset-2 hover:underline"
                    >
                      {medicationLabel(rx)}
                    </Link>
                    <p className="text-label-sm text-ink-secondary md:hidden">
                      Qty {rx.quantity} · start {formatDate(rx.start_date)}
                    </p>
                  </td>
                  <td className="hidden py-3 pr-4 font-mono text-code-sm md:table-cell">{rx.quantity}</td>
                  <td className="hidden py-3 pr-4 whitespace-nowrap md:table-cell">{formatDate(rx.start_date)}</td>
                  <td className="py-3">
                    <Badge tone={prescriptionStatusTone[rx.status]} className="capitalize">
                      {rx.status}
                    </Badge>
                    {note && <p className="mt-1 text-label-sm text-ink-secondary">{note}</p>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </Card>
  );
}
