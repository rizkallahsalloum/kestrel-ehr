"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { AlertTriangleIcon, Button, buttonStyles, SyntheticBanner } from "@/components/ui";
import { reportClientError } from "@/lib/errors/actions";
import { buildClientReport } from "@/lib/errors/client-report";
import { digestOf, newReference, referenceFromDigest } from "@/lib/errors/reference";

/** Props Next.js passes to `error.tsx` and `global-error.tsx`. */
export type ErrorBoundaryProps = { error: unknown; retry: () => void };

/** One report per error object, however often the effect runs (Strict Mode runs it twice). */
const reports = new WeakMap<object, Promise<string | null>>();

/** Sends the report and resolves to its reference, or null if the server did not record it. */
function report(error: unknown, pathname: string): Promise<string | null> {
  const key = typeof error === "object" && error !== null ? error : null;
  const cached = key && reports.get(key);
  if (cached) return cached;
  const reference = newReference();
  const pending = reportClientError(buildClientReport(error, pathname, reference))
    .then((recorded) => (recorded ? reference : null))
    .catch(() => null);
  if (key) reports.set(key, pending);
  return pending;
}

/**
 * Reference for the error on screen. Server errors already carry a digest that the server logged
 * (see `src/instrumentation.ts`); errors thrown in the browser are sent to the server log here,
 * without their message. Nothing is logged to the browser console.
 */
function useErrorReference(error: unknown): string | null | undefined {
  const digest = digestOf(error);
  const route = usePathname();
  const [reported, setReported] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    if (digest) return;
    let active = true;
    void report(error, route ?? "/").then((reference) => {
      if (active) setReported(reference);
    });
    return () => {
      active = false;
    };
  }, [error, digest, route]);

  return digest ? referenceFromDigest(digest) : reported;
}

/**
 * Generic error card. Never shows the error's own text: messages can contain record details, and
 * the details are in the server log under the reference.
 */
export function RouteError({
  error,
  retry,
  title = "Something went wrong",
  message,
  backHref = "/",
  backLabel = "Back to Kestrel EHR",
  fullPage = false,
}: ErrorBoundaryProps & {
  title?: string;
  message: string;
  backHref?: string;
  backLabel?: string;
  fullPage?: boolean;
}) {
  const reference = useErrorReference(error);

  const card = (
    <div className="flex w-full max-w-md flex-col gap-4 rounded-card border border-line-subtle bg-surface p-6">
      <div role="alert" className="flex flex-col gap-2">
        <h1 className="flex items-center gap-2 font-display text-heading-lg font-medium tracking-tight">
          <AlertTriangleIcon className="shrink-0 text-warning" />
          {title}
        </h1>
        <p className="text-body-sm text-ink-strong">{message}</p>
        <p className="text-label-sm text-ink-secondary" data-testid="error-reference">
          Reference:{" "}
          <span className="font-mono">
            {reference === undefined ? "being recorded" : (reference ?? "not recorded")}
          </span>
        </p>
      </div>
      <div className="flex flex-wrap gap-2.5">
        <Button size="sm" onClick={() => retry()}>
          Try again
        </Button>
        <Link href={backHref} className={buttonStyles({ variant: "secondary", size: "sm" })}>
          {backLabel}
        </Link>
      </div>
    </div>
  );

  if (!fullPage) return <div className="flex justify-center py-8">{card}</div>;
  return (
    <div className="flex flex-1 flex-col">
      <SyntheticBanner />
      <main id="main" className="flex flex-1 items-center justify-center p-4 md:p-8">
        {card}
      </main>
    </div>
  );
}
