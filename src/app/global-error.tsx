"use client";

import "./globals.css";
import { RouteError, type ErrorBoundaryProps } from "@/components/shell/route-error";

export default function GlobalError(props: ErrorBoundaryProps) {
  return (
    <html lang="en" className="h-full">
      <body className="flex min-h-full flex-col">
        <title>Something went wrong | Kestrel EHR (synthetic prototype)</title>
        <RouteError
          {...props}
          fullPage
          message="Kestrel EHR could not be loaded. No partial patient data is shown when a required check fails."
        />
      </body>
    </html>
  );
}
