import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NewPrescriptionView } from "@/features/prescriptions/components/prescription-views";
import { getNewPrescriptionContext } from "@/features/prescriptions/queries";
import { todayUtc } from "@/features/prescriptions/schemas";

export const metadata: Metadata = { title: "New prescription draft | Kestrel EHR" };

export default async function NewPrescriptionPage({ params }: PageProps<"/patients/[patientId]/prescriptions/new">) {
  const { patientId } = await params;
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
