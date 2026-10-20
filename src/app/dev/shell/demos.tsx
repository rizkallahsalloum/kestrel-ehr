"use client";

import ErrorPage from "@/app/error";

export function ErrorDemo() {
  return <ErrorPage error={new Error("Specimen error")} retry={() => {}} />;
}
