import type { Metadata } from "next";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { ThrowInBrowser } from "./throw-in-browser";

export const metadata: Metadata = { title: "Error specimen (development only) | Kestrel EHR" };

/** Text the error page must never show; the browser test asserts it stays off screen. */
const FAILURE = "Specimen failure: Testcase, Rowan SYN-000101";

export default async function ErrorSpecimenPage({ searchParams }: PageProps<"/dev/error">) {
  if (process.env.NODE_ENV !== "development") notFound();
  await connection();

  const { kind } = await searchParams;
  if (kind === "client") return <ThrowInBrowser message={FAILURE} />;
  throw new Error(FAILURE);
}
