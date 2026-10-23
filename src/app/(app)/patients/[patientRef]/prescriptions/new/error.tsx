"use client";

import { useParams } from "next/navigation";
import { RouteError, type ErrorBoundaryProps } from "@/components/shell/route-error";
import { patientPath } from "@/features/patients/refs";

export default function NewPrescriptionError(props: ErrorBoundaryProps) {
  const { patientRef } = useParams<{ patientRef: string }>();
  return (
    <RouteError
      {...props}
      message="The prescription workspace could not be loaded. Check the chart for any draft that was already saved."
      backHref={patientPath(patientRef)}
      backLabel="Back to chart"
    />
  );
}
