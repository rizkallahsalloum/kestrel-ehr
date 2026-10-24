import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AppShell, type ShellUser } from "@/components/shell/app-shell";
import { AlertBanner, Card, PrivateText } from "@/components/ui";
import { AllergyPanel, MedicationPanel } from "@/features/chart/components/clinical-lists";
import { PatientHero } from "@/features/chart/components/patient-hero";
import { DiagnosisTable } from "@/features/diagnoses/components/diagnosis-table";
import { Hba1cChart } from "@/features/labs/components/hba1c-chart";
import { AbnormalVitalsBanner } from "@/features/vitals/components/abnormal-vitals-banner";
import { VitalsBand } from "@/features/vitals/components/vitals-band";
import { DIABETES_CASE } from "../chart/clinical";
import { PatientList } from "@/features/patients/components/patient-list";
import { PatientListSkeleton } from "@/features/patients/components/patient-list-skeleton";
import type { Allergy, PatientMedication, PatientSummary } from "@/types/domain";
import { Delayed, delayParam } from "../delayed";
import { demoQueue } from "../demo-queue";
import { FixedPrivacyState, PrivacyDialogDemo, PrivacyNotesDemo } from "./dialog-demo";

export const metadata: Metadata = { title: "Privacy mode specimen (development only) | Kestrel EHR" };

// Static synthetic content for reviewing Privacy mode. No data access.

const CLINICIAN: ShellUser = { fullName: "Dr. Demo Clinician", role: "clinician" };
const team = { name: "North team (synthetic)" };
const PATIENTS: PatientSummary[] = [
  { id: "00000000-0000-4000-8000-000000000101", public_ref: "syn0000101", mrn: "SYN-000101", given_name: "Rowan", family_name: "Testcase", date_of_birth: "1959-03-14", sex: "female", care_team: team },
  { id: "00000000-0000-4000-8000-000000000102", public_ref: "syn0000102", mrn: "SYN-000102", given_name: "Mira", family_name: "Demoson", date_of_birth: "1984-11-02", sex: "female", care_team: team },
];
const ALLERGIES: Allergy[] = [
  {
    id: "a1",
    substance_text: "DEMO-ALPHA class (synthetic)",
    reaction: "Rash (synthetic)",
    severity: "severe",
    drug_class_code: "DEMO-ALPHA",
    status: "active",
  },
];
const MEDICATIONS: PatientMedication[] = [
  {
    id: "m1",
    dose_text: "1 capsule once daily",
    start_date: "2026-09-01",
    status: "active",
    source_prescription_id: null,
    medication: { name: "Calvexa", strength: "250 mg", form: "capsule" },
  },
];

/**
 * The same field masked (fixed, independent of the Privacy button) and as plain text: a shown
 * `PrivateText` would be hidden by the pre-hydration rule while Privacy mode is on.
 */
function ReferenceStates() {
  return (
    <Card title="Reference states">
      <dl className="grid grid-cols-key-value gap-x-2.5 gap-y-2 text-body-sm">
        <dt className="text-ink-strong">Masked</dt>
        <dd>
          <FixedPrivacyState masked>
            <p className="text-body-sm text-ink-strong">
              <PrivateText label="Patient name">Reference, Sample</PrivateText> · MRN{" "}
              <span className="font-mono">
                <PrivateText label="MRN">SYN-000999</PrivateText>
              </span>
            </p>
          </FixedPrivacyState>
        </dd>
        <dt className="text-ink-strong">Shown or revealed</dt>
        <dd>
          <p className="text-body-sm text-ink-strong">
            Reference, Sample · MRN <span className="font-mono">SYN-000999</span>
          </p>
        </dd>
      </dl>
    </Card>
  );
}

export default async function PrivacySpecimenPage({ searchParams }: PageProps<"/dev/privacy">) {
  if (process.env.NODE_ENV !== "development") notFound();

  const params = await searchParams;
  const delay = delayParam(params.delay);

  const content = (
    <div className="flex flex-col gap-4">
      <PatientList patients={PATIENTS} query="" clearHref="/dev/privacy" />
      <PatientHero
        patient={PATIENTS[0]!}
        allergies={ALLERGIES}
        diagnoses={[{ id: "dx-a", description: "Synthetic condition A" }, ...DIABETES_CASE.diagnoses]}
      />
      <AlertBanner tone="critical" title="Allergy conflict on pending order">
        <p>
          Draft: Zentoril 10 mg tablet. Allergy conflict (synthetic) for <PrivateText label="Patient name">Testcase, Rowan</PrivateText>: severe
          DEMO-ALPHA class allergy. Safety information stays visible; only the patient identifier is masked.
        </p>
      </AlertBanner>
      <div className="grid gap-4 md:grid-cols-2">
        <AllergyPanel allergies={ALLERGIES} />
        <MedicationPanel medications={MEDICATIONS} />
      </div>
      <AbnormalVitalsBanner reading={DIABETES_CASE.vitals.at(-1)} />
      <VitalsBand readings={DIABETES_CASE.vitals} />
      <Hba1cChart results={DIABETES_CASE.hba1c} />
      <DiagnosisTable diagnoses={DIABETES_CASE.diagnoses} />
      <Card title="Encounter note (synthetic)">
        <div className="flex flex-col gap-3">
          <PrivacyNotesDemo />
          <div>
            <PrivacyDialogDemo />
          </div>
        </div>
      </Card>
      <ReferenceStates />
      <p className="text-label-sm text-ink-muted">
        Development specimen. Privacy mode: the Privacy button, Ctrl+. (Cmd+. on a Mac) or no activity for the
        configured time. Navigate to the{" "}
        <Link href="/dev/chart?view=blocking" className="underline">
          chart specimen
        </Link>
        {" · "}
        <Link href="/dev/prescribing?view=ready" className="underline">
          prescribing specimen
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
    <AppShell
      user={CLINICIAN}
      activePath="/patients"
      queue={demoQueue(params.queue, params.queueOrder)}
      renderedAt={new Date().toISOString()}
      searchAction="/dev/shell"
      searchHiddenFields={{ view: "clinician" }}
    >
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
