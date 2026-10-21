"use client";

import { useParams } from "next/navigation";
import { RouteError, type ErrorBoundaryProps } from "@/components/shell/route-error";

export default function PrescriptionError(props: ErrorBoundaryProps) {
  const { patientId } = useParams<{ patientId: string }>();
  return (
    <RouteError
      {...props}
      message="This prescription could not be loaded. Check its status on the chart before acting on it."
      backHref={`/patients/${patientId}`}
      backLabel="Back to chart"
    />
  );
}
