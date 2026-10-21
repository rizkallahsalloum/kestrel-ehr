"use client";

import { RouteError, type ErrorBoundaryProps } from "@/components/shell/route-error";

export default function AuditError(props: ErrorBoundaryProps) {
  return <RouteError {...props} message="The audit log could not be loaded." />;
}
