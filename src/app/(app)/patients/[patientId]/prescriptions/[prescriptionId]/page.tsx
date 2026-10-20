import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PrescriptionView } from "@/features/prescriptions/components/prescription-views";
import { getPrescriptionWorkspace } from "@/features/prescriptions/queries";

export const metadata: Metadata = { title: "Prescription | Kestrel EHR" };

export default async function PrescriptionPage({
  params,
}: PageProps<"/patients/[patientId]/prescriptions/[prescriptionId]">) {
  const { patientId, prescriptionId } = await params;
  const workspace = await getPrescriptionWorkspace(patientId, prescriptionId);
  if (!workspace) notFound();

  return <PrescriptionView workspace={workspace} />;
}
