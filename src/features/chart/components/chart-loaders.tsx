import { notFound } from "next/navigation";
import { getChartAlertData, getChartRest, type ChartHeader } from "@/features/chart/queries";
import { ChartAlerts, ChartMain, ChartMedications } from "./patient-chart-view";

// Async parts of the chart page. Each awaits the request-memoized loaders, so the page's header,
// these parts and the preload share one audit write and one read per table.

/** Rendered before anything streams (no Suspense of its own); errors stop at ChartAlertBoundary. */
export async function ChartAlertsLoader({ patientId, patientRef }: { patientId: string; patientRef: string }) {
  const data = await getChartAlertData(patientId);
  if (!data) notFound();
  return <ChartAlerts patientRef={patientRef} data={data} />;
}

export async function ChartMainLoader({ patientId, header }: { patientId: string; header: ChartHeader }) {
  const [data, rest] = await Promise.all([getChartAlertData(patientId), getChartRest(patientId)]);
  if (!data || !rest) notFound();
  return <ChartMain header={header} data={data} rest={rest} />;
}

export async function ChartMedicationsLoader({ patientId, patientRef }: { patientId: string; patientRef: string }) {
  const rest = await getChartRest(patientId);
  if (!rest) notFound();
  return <ChartMedications patientRef={patientRef} rest={rest} />;
}
