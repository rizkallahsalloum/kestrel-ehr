import type { ReactNode } from "react";
import { countUncheckedDrafts, summarizeDraftAlerts } from "@/features/chart/alerts";
import type { ChartAlertData, ChartHeader, ChartRest } from "@/features/chart/queries";
import { DiagnosisTable } from "@/features/diagnoses/components/diagnosis-table";
import { EncounterNotesPanel } from "@/features/encounter-notes/components/encounter-notes-panel";
import { Hba1cChart } from "@/features/labs/components/hba1c-chart";
import { VitalsBand } from "@/features/vitals/components/vitals-band";
import { ChartAlertBoundary } from "./chart-alert-boundary";
import { ChartAlertSlot } from "./chart-alert-slot";
import { MedicationPanel, PrescriptionsCard } from "./clinical-lists";
import { PatientHero } from "./patient-hero";

export const CHART_FOOTER =
  "Synthetic record. Vitals, HbA1c results, diagnoses and notes are synthetic; vitals status and safety alerts come from illustrative demo rules, not clinical guidance. Other labs, imaging and scheduling are not part of this prototype.";

/**
 * Dashboard workspace: chart column plus a sticky allergy and medication column on wide screens.
 * The page renders `hero`, `alerts` and `allergies` before anything streams; `main` and
 * `medications` may be Suspense boundaries whose fallbacks keep the same boxes.
 */
export function ChartLayout({
  hero,
  alerts,
  main,
  allergies,
  medications,
}: {
  hero: ReactNode;
  alerts: ReactNode;
  main: ReactNode;
  allergies: ReactNode;
  medications: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid items-start gap-lg workspace:grid-cols-workspace">
        <div className="flex min-w-0 flex-col gap-4.5">
          <div className="animate-fade-up">{hero}</div>
          <div className="animate-fade-up-2">
            <ChartAlertBoundary>{alerts}</ChartAlertBoundary>
          </div>
          <div className="flex animate-fade-up-3 flex-col gap-4.5">{main}</div>
        </div>
        <aside
          aria-label="Allergies and medications"
          className="flex animate-fade-up-context flex-col gap-4 workspace:sticky workspace:top-below-topbar"
        >
          {allergies}
          {medications}
        </aside>
      </div>
      <p className="max-w-footer text-label-sm text-ink-muted">{CHART_FOOTER}</p>
    </div>
  );
}

export function ChartHero({ header }: { header: ChartHeader }) {
  const activeDiagnoses = header.diagnoses.filter((diagnosis) => diagnosis.status === "active");
  return <PatientHero patient={header.patient} allergies={header.allergies} diagnoses={activeDiagnoses} />;
}

export function ChartAlerts({ patientRef, data }: { patientRef: string; data: ChartAlertData }) {
  return (
    <ChartAlertSlot
      patientRef={patientRef}
      summaries={summarizeDraftAlerts(data.prescriptions, data.draftAlerts)}
      uncheckedDrafts={countUncheckedDrafts(data.prescriptions)}
      latestVitals={data.vitals.at(-1)}
    />
  );
}

/** Below the alert slot. `notesEditor` replaces the notes editor (dev specimens pass a stub). */
export function ChartMain({
  header,
  data,
  rest,
  notesEditor,
}: {
  header: ChartHeader;
  data: ChartAlertData;
  rest: ChartRest;
  notesEditor?: ReactNode;
}) {
  const { patient } = header;
  return (
    <>
      <VitalsBand readings={data.vitals} />
      <Hba1cChart results={rest.hba1c} />
      <DiagnosisTable diagnoses={header.diagnoses} />
      <PrescriptionsCard patientRef={patient.public_ref} prescriptions={data.prescriptions} draftAlerts={data.draftAlerts} />
      <EncounterNotesPanel patientId={patient.id} notes={rest.notes} editor={notesEditor} />
    </>
  );
}

export function ChartMedications({ patientRef, rest }: { patientRef: string; rest: ChartRest }) {
  return <MedicationPanel medications={rest.medications} patientRef={patientRef} />;
}