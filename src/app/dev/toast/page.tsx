import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AppShell, type ShellUser } from "@/components/shell/app-shell";
import { Button, PrivateText, ToastProvider } from "@/components/ui";
import { demoQueue } from "../demo-queue";
import { ToastDemo } from "./toast-demo";

export const metadata: Metadata = { title: "Toast specimen (development only) | Kestrel EHR" };

// Toast states inside the real shell, so the top bar, Privacy mode and 390px can be checked. No data access.

const CLINICIAN: ShellUser = { fullName: "Dr. Demo Clinician", role: "clinician" };
const SHOW = ["one", "four", "dialog"] as const;

export default async function ToastSpecimenPage({ searchParams }: PageProps<"/dev/toast">) {
  if (process.env.NODE_ENV !== "development") notFound();
  const params = await searchParams;
  const show = SHOW.find((s) => s === params.show);

  return (
    <ToastProvider>
      <AppShell user={CLINICIAN} activePath="/patients" queue={demoQueue(params.queue)} renderedAt={new Date().toISOString()}>
        <div className="flex flex-col gap-6">
          <h1 className="font-display text-heading-xl font-medium tracking-tight">Toast specimen</h1>
          <p className="text-body-sm text-ink-secondary">
            Development specimen. States: <code>?show=one</code>, <code>?show=four</code> (three on screen, one
            waiting), <code>?show=dialog</code> (waits for the dialog). Synthetic patient for Privacy mode:{" "}
            <PrivateText label="Patient name">Testcase, Rowan</PrivateText>.
          </p>
          <ToastDemo show={show} />
          {/* The review panel's actions, for the overlap check at 390px. Not wired. */}
          <div data-specimen-actions="" className="grid grid-cols-2 gap-2">
            <Button size="cta">Sign prescription (simulated)</Button>
            <Button variant="secondary">Save draft</Button>
          </div>
        </div>
      </AppShell>
    </ToastProvider>
  );
}
