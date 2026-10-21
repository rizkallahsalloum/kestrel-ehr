"use client";

import { RouteError, type ErrorBoundaryProps } from "@/components/shell/route-error";

export default function LoginError(props: ErrorBoundaryProps) {
  return (
    <RouteError
      {...props}
      fullPage
      message="The sign-in page could not be loaded."
      backHref="/login"
      backLabel="Reload sign-in"
    />
  );
}
