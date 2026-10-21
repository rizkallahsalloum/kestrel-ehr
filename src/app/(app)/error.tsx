"use client";

import { RouteError, type ErrorBoundaryProps } from "@/components/shell/route-error";

export default function AppError(props: ErrorBoundaryProps) {
  return <RouteError {...props} message="This page could not be loaded." />;
}
