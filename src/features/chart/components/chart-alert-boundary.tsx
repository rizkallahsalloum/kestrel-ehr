"use client"; // catchError builds a client error boundary, and Try again needs a click handler.

import { catchError, type ErrorInfo } from "next/error";
import { AlertBanner, Button } from "@/components/ui";

export const ALERT_SLOT_ERROR = "Demo safety alerts could not be loaded";

/**
 * Replaces only the alert slot when it fails, so the hero and the rest of the chart stay. Never
 * shows the error's own text, which could hold record details.
 */
function AlertSlotError(_props: object, { retry }: ErrorInfo) {
  return (
    <section aria-labelledby="chart-alerts-heading" data-alert-slot-error="">
      <h2 id="chart-alerts-heading" className="sr-only">
        Demo safety alerts
      </h2>
      <AlertBanner
        tone="warning"
        role="alert"
        title={ALERT_SLOT_ERROR}
        actions={
          <Button size="sm" variant="secondary" onClick={() => retry()}>
            Try again
          </Button>
        }
      >
        <p>Critical vitals and draft alert banners may be missing. Open each draft to check its alerts.</p>
      </AlertBanner>
    </section>
  );
}

export const ChartAlertBoundary = catchError(AlertSlotError);
