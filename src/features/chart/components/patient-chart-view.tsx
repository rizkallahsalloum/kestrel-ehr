import { countUncheckedDrafts, summarizeDraftAlerts } from "@/features/chart/alerts";
import type { PatientChart } from "@/features/chart/queries";
import { ChartAlertSlot } from "./chart-alert-slot";
import { AllergyPanel, MedicationPanel, PrescriptionsCard } from "./clinical-lists";
import { PatientHero } from "./patient-hero";

/** Dashboard workspace: chart column plus a sticky allergy and medication column on wide screens. */
export function PatientChartView({ chart }: { chart: PatientChart }) {
  const { patient } = chart;
  return (
    <div className="flex flex-col gap-4">
      <div className="grid items-start gap-lg workspace:grid-cols-workspace">
        <div className="flex min-w-0 flex-col gap-4.5">
          <div className="animate-fade-up">
            <PatientHero patient={patient} allergies={chart.allergies} />
          </div>
          <div className="animate-fade-up-2">
            <ChartAlertSlot
              patientId={patient.id}
              summaries={summarizeDraftAlerts(chart.prescriptions, chart.draftAlerts)}
              uncheckedDrafts={countUncheckedDrafts(chart.prescriptions)}
            />
          </div>
          <div className="animate-fade-up-3">
            <PrescriptionsCard
              patientId={patient.id}
              prescriptions={chart.prescriptions}
              draftAlerts={chart.draftAlerts}
            />
          </div>
        </div>
        <aside
          aria-label="Allergies and medications"
          className="flex animate-fade-up-context flex-col gap-4 workspace:sticky workspace:top-below-topbar"
        >
          <AllergyPanel allergies={chart.allergies} />
          <MedicationPanel medications={chart.medications} />
        </aside>
      </div>
      <p className="max-w-footer text-label-sm text-ink-muted">
        Synthetic record. This prototype models allergies, medications and demo prescriptions only; vitals, labs,
        diagnoses, encounter notes and scheduling are not part of it.
      </p>
    </div>
  );
}
