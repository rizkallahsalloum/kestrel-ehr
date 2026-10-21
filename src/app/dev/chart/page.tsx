import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AppShell, type ShellUser } from "@/components/shell/app-shell";
import { ChartSkeleton } from "@/features/chart/components/chart-skeleton";
import { PatientChartView } from "@/features/chart/components/patient-chart-view";
import { Delayed, delayParam } from "../delayed";
import type { PatientChart } from "@/features/chart/queries";
import type { DraftAlertRow, PatientSummary, PrescriptionListItem } from "@/types/domain";

export const metadata: Metadata = { title: "Chart specimen (development only) | Kestrel EHR" };

// Static synthetic content for reviewing the Phase 4 chart. Mirrors supabase/seed/synthetic.sql; no data access.

const CLINICIAN: ShellUser = { fullName: "Dr. Demo Clinician", role: "clinician" };
const team = { name: "North team (synthetic)" };
const prescriber = "a0000000-0000-4000-8000-000000000001";

const MEDS = {
  zentoril: { name: "Zentoril", strength: "10 mg", form: "tablet" },
  calvexa: { name: "Calvexa", strength: "250 mg", form: "capsule" },
  morivane: { name: "Morivane", strength: "5 mg", form: "tablet" },
  tessaline: { name: "Tessaline", strength: "20 mg", form: "tablet" },
  ploxidrin: { name: "Ploxidrin", strength: "100 mg", form: "tablet" },
};

function patient(n: number, given_name: string, family_name: string, date_of_birth: string, sex: string): PatientSummary {
  return { id: `00000000-0000-4000-8000-00000000010${n}`, mrn: `SYN-00010${n}`, given_name, family_name, date_of_birth, sex, care_team: team };
}

function rx(id: string, medication: PrescriptionListItem["medication"], overrides: Partial<PrescriptionListItem> = {}): PrescriptionListItem {
  return {
    id: `00000000-0000-4000-8000-0000000002${id}`,
    status: "draft",
    version: 1,
    last_evaluated_version: 1,
    quantity: 30,
    start_date: "2026-10-19",
    created_at: "2026-10-19T08:00:00Z",
    signed_at: null,
    prescriber_id: prescriber,
    medication,
    ...overrides,
  };
}

function alert(id: string, prescriptionId: string, severity: DraftAlertRow["severity"], message: string, acknowledged = false): DraftAlertRow {
  return {
    id: `00000000-0000-4000-8000-0000000003${id}`,
    prescription_id: `00000000-0000-4000-8000-0000000002${prescriptionId}`,
    prescription_version: 1,
    severity,
    message,
    decision: acknowledged ? { id: `00000000-0000-4000-8000-0000000004${id}` } : null,
  };
}

const RULE_ALPHA = "DEMO RULE: recorded allergy to demo class Alpha. Illustrative only, not clinical guidance.";
const RULE_BETA_GAMMA = "DEMO RULE: demo classes Beta and Gamma flagged together. Illustrative only, not clinical guidance.";

const CHARTS = {
  blocking: {
    patient: patient(1, "Rowan", "Testcase", "1959-03-14", "female"),
    allergies: [
      { id: "a1", substance_text: "Demo class Alpha agents", reaction: "Synthetic rash (example)", severity: "severe", drug_class_code: "DEMO-ALPHA", status: "active" },
      { id: "a5", substance_text: "Demo class Delta agents", reaction: "Synthetic itch (example)", severity: "mild", drug_class_code: "DEMO-DELTA", status: "active" },
    ],
    medications: [
      { id: "m1", dose_text: "20 mg oral once daily", start_date: "2026-01-10", status: "active", source_prescription_id: null, medication: MEDS.tessaline },
    ],
    prescriptions: [
      rx("01", MEDS.zentoril),
      rx("02", MEDS.morivane, { status: "signed", signed_at: "2026-09-02T09:15:00Z", start_date: "2026-09-02", created_at: "2026-09-02T09:00:00Z" }),
      rx("03", MEDS.ploxidrin, { status: "cancelled", quantity: 14, start_date: "2026-08-20", created_at: "2026-08-20T10:00:00Z" }),
    ],
    draftAlerts: [alert("01", "01", "blocking", RULE_ALPHA)],
  },
  advisory: {
    patient: patient(2, "Mira", "Demoson", "1984-11-02", "female"),
    allergies: [],
    medications: [
      { id: "m2", dose_text: "5 mg oral once daily", start_date: "2026-02-01", status: "active", source_prescription_id: null, medication: MEDS.morivane },
      { id: "m3", dose_text: "20 mg oral once daily", start_date: "2026-09-02", status: "active", source_prescription_id: "00000000-0000-4000-8000-000000000299", medication: MEDS.tessaline },
    ],
    prescriptions: [
      rx("11", MEDS.calvexa),
      rx("12", MEDS.ploxidrin, { version: 2, last_evaluated_version: 1, quantity: 14 }),
    ],
    draftAlerts: [alert("11", "11", "advisory", RULE_BETA_GAMMA)],
  },
  "no-drafts": {
    patient: patient(3, "Ellis", "Placeholder", "1971-06-27", "male"),
    allergies: [
      { id: "a2", substance_text: "Demo class Gamma agents", reaction: "Synthetic hives (example)", severity: "moderate", drug_class_code: "DEMO-GAMMA", status: "active" },
      { id: "a3", substance_text: "Demo class Beta agents", reaction: "Synthetic nausea (example)", severity: "mild", drug_class_code: "DEMO-BETA", status: "active" },
    ],
    medications: [
      { id: "m4", dose_text: "10 mg oral once daily", start_date: "2026-03-15", status: "active", source_prescription_id: "00000000-0000-4000-8000-000000000221", medication: MEDS.zentoril },
    ],
    prescriptions: [
      rx("21", MEDS.zentoril, { status: "signed", signed_at: "2026-03-15T11:40:00Z", start_date: "2026-03-15", created_at: "2026-03-15T11:30:00Z" }),
    ],
    draftAlerts: [],
  },
  // Blocking and advisory side by side; input deliberately out of severity order.
  mixed: {
    patient: patient(5, "Sasha", "Mockwell", "1966-08-21", "female"),
    allergies: [
      { id: "a6", substance_text: "Demo class Beta agents", reaction: "Synthetic nausea (example)", severity: "mild", drug_class_code: "DEMO-BETA", status: "active" },
      { id: "a7", substance_text: "Demo class Gamma agents", reaction: "Synthetic hives (example)", severity: "moderate", drug_class_code: "DEMO-GAMMA", status: "active" },
      { id: "a8", substance_text: "Demo class Alpha agents", reaction: "Synthetic rash (example)", severity: "severe", drug_class_code: "DEMO-ALPHA", status: "active" },
    ],
    medications: [
      { id: "m5", dose_text: "5 mg oral once daily", start_date: "2026-02-01", status: "active", source_prescription_id: null, medication: MEDS.morivane },
    ],
    prescriptions: [
      rx("31", MEDS.calvexa, { created_at: "2026-10-19T09:00:00Z" }),
      rx("32", MEDS.zentoril),
    ],
    draftAlerts: [alert("31", "31", "advisory", RULE_BETA_GAMMA), alert("32", "32", "blocking", RULE_ALPHA)],
  },
  "no-allergies": {
    patient: patient(4, "Zoë", "Sampleton", "2001-01-09", "female"),
    allergies: [],
    medications: [],
    prescriptions: [],
    draftAlerts: [],
  },
} satisfies Record<string, PatientChart>;

type View = keyof typeof CHARTS;
const VIEWS = Object.keys(CHARTS) as View[];

export default async function ChartSpecimenPage({ searchParams }: PageProps<"/dev/chart">) {
  if (process.env.NODE_ENV !== "development") notFound();

  const params = await searchParams;
  const view: View = VIEWS.find((v) => v === params.view) ?? "blocking";
  const delay = delayParam(params.delay);

  const content = (
    <>
      <PatientChartView chart={CHARTS[view]} backHref="/dev/shell?view=clinician" />
      <p className="mt-6 text-label-sm text-ink-muted">
        Development specimen. Views:{" "}
        {VIEWS.map((v, i) => (
          <span key={v}>
            {i > 0 && " · "}
            <Link href={`/dev/chart?view=${v}`} className="underline">
              {v}
            </Link>
          </span>
        ))}
        {" · "}
        <Link href={`/dev/chart?view=${view}&skeleton=1`} className="underline">
          skeleton
        </Link>
      </p>
    </>
  );

  return (
    <AppShell user={CLINICIAN} activePath="/patients" searchAction="/dev/shell" searchHiddenFields={{ view: "clinician" }}>
      {params.skeleton ? (
        <ChartSkeleton />
      ) : delay ? (
        <Suspense fallback={<ChartSkeleton />}>
          <Delayed ms={delay}>{content}</Delayed>
        </Suspense>
      ) : (
        content
      )}
    </AppShell>
  );
}
