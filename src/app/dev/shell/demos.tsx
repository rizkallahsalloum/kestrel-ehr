"use client";

import ErrorPage from "@/app/error";

// A digest marks it as a server error, so the specimen shows a reference without sending a report.
const specimenError = Object.assign(new Error("Specimen error"), { digest: "0000000000" });

export function ErrorDemo() {
  return <ErrorPage error={specimenError} retry={() => {}} />;
}
