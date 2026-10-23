import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { resolvePrescriptionSegments } from "@/features/patients/resolve";
import { PrescriptionView } from "@/features/prescriptions/components/prescription-views";
import { getPrescriptionWorkspace } from "@/features/prescriptions/queries";

export const metadata: Metadata = { title: "Prescription | Kestrel EHR" };

export default async function PrescriptionPage({
  params,
}: PageProps<"/patients/[patientRef]/prescriptions/[prescriptionRef]">) {
  const { patientRef, prescriptionRef } = await params;
  const { patientId, prescriptionId } = await resolvePrescriptionSegments(patientRef, prescriptionRef);
  const workspace = await getPrescriptionWorkspace(patientId, prescriptionId);
  if (!workspace) notFound();

  return <PrescriptionView workspace={workspace} />;
}
