import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AppShell, type ShellUser } from "@/components/shell/app-shell";
import { Card, FormField, TextArea } from "@/components/ui";
import { PatientList } from "@/features/patients/components/patient-list";
import { PatientListSkeleton } from "@/features/patients/components/patient-list-skeleton";
import type { PatientSummary } from "@/types/domain";
import { DialogDemo } from "../components/demos";
import { Delayed, delayParam } from "../delayed";

export const metadata: Metadata = { title: "Privacy mode specimen (development only) | Kestrel EHR" };

// Static synthetic content for reviewing Privacy mode. No data access.

const CLINICIAN: ShellUser = { fullName: "Dr. Demo Clinician", role: "clinician" };
const team = { name: "North team (synthetic)" };
const PATIENTS: PatientSummary[] = [
  { id: "00000000-0000-4000-8000-000000000101", mrn: "SYN-000101", given_name: "Rowan", family_name: "Testcase", date_of_birth: "1959-03-14", sex: "female", care_team: team },
  { id: "00000000-0000-4000-8000-000000000102", mrn: "SYN-000102", given_name: "Mira", family_name: "Demoson", date_of_birth: "1984-11-02", sex: "female", care_team: team },
];

export default async function PrivacySpecimenPage({ searchParams }: PageProps<"/dev/privacy">) {
  if (process.env.NODE_ENV !== "development") notFound();

  const params = await searchParams;
  const delay = delayParam(params.delay);

  const content = (
    <div className="flex flex-col gap-4">
      <PatientList patients={PATIENTS} query="" clearHref="/dev/privacy" />
      <Card title="Encounter note (synthetic)">
        <FormField id="privacy-notes" label="Notes" helper="Synthetic text only. Typing keeps Privacy mode from switching on.">
          <TextArea rows={3} defaultValue="Synthetic note for Testcase, Rowan (SYN-000101)." />
        </FormField>
        <div className="mt-3">
          <DialogDemo />
        </div>
      </Card>
      <p className="text-label-sm text-ink-muted">
        Development specimen. Privacy mode: the Privacy button, Ctrl+. (Cmd+. on a Mac) or no activity for the
        configured time. Navigate to the{" "}
        <Link href="/dev/chart?view=blocking" className="underline">
          chart specimen
        </Link>
        {" · "}
        <Link href="/dev/privacy?delay=1500" className="underline">
          this page with a loading skeleton
        </Link>
        {" · "}
        <Link href="/dev/privacy?skeleton=1" className="underline">
          skeleton
        </Link>
      </p>
    </div>
  );

  return (
    <AppShell user={CLINICIAN} activePath="/patients" searchAction="/dev/shell" searchHiddenFields={{ view: "clinician" }}>
      {params.skeleton ? (
        <PatientListSkeleton />
      ) : delay ? (
        <Suspense fallback={<PatientListSkeleton />}>
          <Delayed ms={delay}>{content}</Delayed>
        </Suspense>
      ) : (
        content
      )}
    </AppShell>
  );
}
