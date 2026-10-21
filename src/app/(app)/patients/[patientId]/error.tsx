"use client";

import { RouteError, type ErrorBoundaryProps } from "@/components/shell/route-error";

export default function PatientChartError(props: ErrorBoundaryProps) {
  return (
    <RouteError
      {...props}
      message="The patient chart could not be loaded. No partial patient data is shown."
      backHref="/patients"
      backLabel="Back to patients"
    />
  );
}
