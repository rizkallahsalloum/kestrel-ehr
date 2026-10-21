"use client";

import { RouteError, type ErrorBoundaryProps } from "@/components/shell/route-error";

export default function ErrorPage(props: ErrorBoundaryProps) {
  return (
    <RouteError
      {...props}
      fullPage
      message="The page could not be loaded. No partial patient data is shown when a required check fails."
    />
  );
}
