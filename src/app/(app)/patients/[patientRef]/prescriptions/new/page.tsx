import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { resolvePatientSegment } from "@/features/patients/resolve";
import { NewPrescriptionView } from "@/features/prescriptions/components/prescription-views";
import { getNewPrescriptionContext } from "@/features/prescriptions/queries";
import { todayUtc } from "@/features/prescriptions/schemas";

export const metadata: Metadata = { title: "New prescription draft | Kestrel EHR" };

export default async function NewPrescriptionPage({ params }: PageProps<"/patients/[patientRef]/prescriptions/new">) {
  const { patientRef } = await params;
  const { patientId } = await resolvePatientSegment(patientRef, "/prescriptions/new");
  const context = await getNewPrescriptionContext(patientId);
  if (!context) notFound();

  return (
    <NewPrescriptionView
      {...context}
      // A fresh key per render makes a double submit of this form idempotent.
      idempotencyKey={crypto.randomUUID()}
      startDate={todayUtc()}
    />
  );
}
