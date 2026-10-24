import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ChartAlertsLoader, ChartMainLoader, ChartMedicationsLoader } from "@/features/chart/components/chart-loaders";
import { ChartMainSkeleton, MedicationPanelSkeleton } from "@/features/chart/components/chart-skeleton";
import { AllergyPanel } from "@/features/chart/components/clinical-lists";
import { ChartHero, ChartLayout } from "@/features/chart/components/patient-chart-view";
import { getChartHeader, preloadChart } from "@/features/chart/queries";
import { PatientContextStrip } from "@/features/patients/components/patient-context";
import { resolvePatientSegment } from "@/features/patients/resolve";

export const metadata: Metadata = { title: "Patient chart | Kestrel EHR" };

// The patient-context strip, the hero, the alert slot and the allergy panel render before anything
// streams, so their boxes are final from the first paint; only the content below waits behind a skeleton.
export default async function PatientChartPage({ params }: PageProps<"/patients/[patientRef]">) {
  const { patientRef } = await params;
  const { patientId } = await resolvePatientSegment(patientRef);
  preloadChart(patientId);
  const header = await getChartHeader(patientId);
  if (!header) notFound();
  const ref = header.patient.public_ref;

  return (
    <>
      <PatientContextStrip patient={header.patient} />
      <ChartLayout
        hero={<ChartHero header={header} />}
        alerts={<ChartAlertsLoader patientId={patientId} patientRef={ref} />}
        main={
          <Suspense fallback={<ChartMainSkeleton />}>
            <ChartMainLoader patientId={patientId} header={header} />
          </Suspense>
        }
        allergies={<AllergyPanel allergies={header.allergies} />}
        medications={
          <Suspense fallback={<MedicationPanelSkeleton />}>
            <ChartMedicationsLoader patientId={patientId} patientRef={ref} />
          </Suspense>
        }
      />
    </>
  );
}
