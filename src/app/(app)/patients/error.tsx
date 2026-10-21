"use client";

import { RouteError, type ErrorBoundaryProps } from "@/components/shell/route-error";

export default function PatientListError(props: ErrorBoundaryProps) {
  return <RouteError {...props} message="The patient list could not be loaded." />;
}
