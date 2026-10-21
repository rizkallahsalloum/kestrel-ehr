"use client";

import { useParams } from "next/navigation";
import { RouteError, type ErrorBoundaryProps } from "@/components/shell/route-error";

export default function NewPrescriptionError(props: ErrorBoundaryProps) {
  const { patientId } = useParams<{ patientId: string }>();
  return (
    <RouteError
      {...props}
      message="The prescription workspace could not be loaded. Check the chart for any draft that was already saved."
      backHref={`/patients/${patientId}`}
      backLabel="Back to chart"
    />
  );
}
