import type { ReactNode } from "react";
import { countUncheckedDrafts, summarizeDraftAlerts } from "@/features/chart/alerts";
import type { PatientChart } from "@/features/chart/queries";
import { DiagnosisTable } from "@/features/diagnoses/components/diagnosis-table";
import { EncounterNotesPanel } from "@/features/encounter-notes/components/encounter-notes-panel";
import { Hba1cChart } from "@/features/labs/components/hba1c-chart";
import { VitalsBand } from "@/features/vitals/components/vitals-band";
import { ChartAlertSlot } from "./chart-alert-slot";
import { AllergyPanel, MedicationPanel, PrescriptionsCard } from "./clinical-lists";
import { PatientHero } from "./patient-hero";

export const CHART_FOOTER =
  "Synthetic record. Vitals, HbA1c results, diagnoses and notes are synthetic; vitals status and safety alerts come from illustrative demo rules, not clinical guidance. Other labs, imaging and scheduling are not part of this prototype.";

/**
 * Dashboard workspace: chart column plus a sticky allergy and medication column on wide screens.
 * `notesEditor` replaces the notes editor (dev specimens pass one with a stubbed save).
 */
export function PatientChartView({ chart, notesEditor }: { chart: PatientChart; notesEditor?: ReactNode }) {
  const { patient } = chart;
  const activeDiagnoses = chart.diagnoses.filter((diagnosis) => diagnosis.status === "active");
  return (
    <div className="flex flex-col gap-4">
      <div className="grid items-start gap-lg workspace:grid-cols-workspace">
        <div className="flex min-w-0 flex-col gap-4.5">
          <div className="animate-fade-up">
            <PatientHero patient={patient} allergies={chart.allergies} diagnoses={activeDiagnoses} />
          </div>
          <div className="animate-fade-up-2">
            <ChartAlertSlot
              patientRef={patient.public_ref}
              summaries={summarizeDraftAlerts(chart.prescriptions, chart.draftAlerts)}
              uncheckedDrafts={countUncheckedDrafts(chart.prescriptions)}
            />
          </div>
          <div className="flex animate-fade-up-3 flex-col gap-4.5">
            <VitalsBand readings={chart.vitals} />
            <Hba1cChart results={chart.hba1c} />
            <DiagnosisTable diagnoses={chart.diagnoses} />
            <PrescriptionsCard
              patientRef={patient.public_ref}
              prescriptions={chart.prescriptions}
              draftAlerts={chart.draftAlerts}
            />
            <EncounterNotesPanel patientId={patient.id} notes={chart.notes} editor={notesEditor} />
          </div>
        </div>
        <aside
          aria-label="Allergies and medications"
          className="flex animate-fade-up-context flex-col gap-4 workspace:sticky workspace:top-below-topbar"
        >
          <AllergyPanel allergies={chart.allergies} />
          <MedicationPanel medications={chart.medications} patientRef={patient.public_ref} />
        </aside>
      </div>
      <p className="max-w-footer text-label-sm text-ink-muted">{CHART_FOOTER}</p>
    </div>
  );
}
