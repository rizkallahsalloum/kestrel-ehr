import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PatientChartView } from "@/features/chart/components/patient-chart-view";
import { getPatientChart } from "@/features/chart/queries";
import { resolvePatientSegment } from "@/features/patients/resolve";

export const metadata: Metadata = { title: "Patient chart | Kestrel EHR" };

export default async function PatientChartPage({ params }: PageProps<"/patients/[patientRef]">) {
  const { patientRef } = await params;
  const { patientId } = await resolvePatientSegment(patientRef);
  const chart = await getPatientChart(patientId);
  if (!chart) notFound();

  return <PatientChartView chart={chart} />;
}
