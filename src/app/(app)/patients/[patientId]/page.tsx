import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PatientChartView } from "@/features/chart/components/patient-chart-view";
import { getPatientChart } from "@/features/chart/queries";

export const metadata: Metadata = { title: "Patient chart | Kestrel EHR" };

export default async function PatientChartPage({ params }: PageProps<"/patients/[patientId]">) {
  const { patientId } = await params;
  const chart = await getPatientChart(patientId);
  if (!chart) notFound();

  return <PatientChartView chart={chart} />;
}
