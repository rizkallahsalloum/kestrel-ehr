"use client";

import { useParams } from "next/navigation";
import { RouteError, type ErrorBoundaryProps } from "@/components/shell/route-error";
import { patientPath } from "@/features/patients/refs";

export default function PrescriptionError(props: ErrorBoundaryProps) {
  const { patientRef } = useParams<{ patientRef: string }>();
  return (
    <RouteError
      {...props}
      message="This prescription could not be loaded. Check its status on the chart before acting on it."
      backHref={patientPath(patientRef)}
      backLabel="Back to chart"
    />
  );
}
