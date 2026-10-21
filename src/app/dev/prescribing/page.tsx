import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AppShell, type ShellUser } from "@/components/shell/app-shell";
import { PrescribingSkeleton } from "@/features/prescriptions/components/prescribing-skeleton";
import { NewPrescriptionView, PrescriptionView } from "@/features/prescriptions/components/prescription-views";
import type { PrescriptionWorkspace } from "@/features/prescriptions/queries";
import { todayUtc } from "@/features/prescriptions/schemas";
import type { Allergy, MedicationOption, PatientMedication, PatientSummary, Prescription, PrescriptionAlert } from "@/types/domain";
import { Delayed, delayParam } from "../delayed";

export const metadata: Metadata = { title: "Prescribing specimen (development only) | Kestrel EHR" };

// Static synthetic content for reviewing the Phase 5 prescribing workspace. Mirrors
// supabase/seed/synthetic.sql; no data access. Server Actions are wired but fail without Supabase.

const CLINICIAN: ShellUser = { fullName: "Dr. Demo Clinician", role: "clinician" };
const PRESCRIBER = "a0000000-0000-4000-8000-000000000001";
const OTHER_PRESCRIBER = "a0000000-0000-4000-8000-000000000002";

const CATALOG: MedicationOption[] = [
  { id: "3e000000-0000-4000-8000-000000000002", name: "Calvexa", strength: "250 mg", form: "capsule", drug_class_code: "DEMO-BETA" },
  { id: "3e000000-0000-4000-8000-000000000003", name: "Morivane", strength: "5 mg", form: "tablet", drug_class_code: "DEMO-GAMMA" },
  { id: "3e000000-0000-4000-8000-000000000005", name: "Ploxidrin", strength: "100 mg", form: "tablet", drug_class_code: "DEMO-BETA" },
  { id: "3e000000-0000-4000-8000-000000000004", name: "Tessaline", strength: "20 mg", form: "tablet", drug_class_code: "DEMO-DELTA" },
  { id: "3e000000-0000-4000-8000-000000000001", name: "Zentoril", strength: "10 mg", form: "tablet", drug_class_code: "DEMO-ALPHA" },
];
const med = (name: string) => CATALOG.find((m) => m.name === name)!;

const PATIENT: PatientSummary = {
  id: "00000000-0000-4000-8000-000000000101",
  mrn: "SYN-000101",
  given_name: "Rowan",
  family_name: "Testcase",
  date_of_birth: "1959-03-14",
  sex: "female",
  care_team: { name: "North team (synthetic)" },
};

const ALLERGIES: Allergy[] = [
  { id: "a1", substance_text: "Demo class Alpha agents", reaction: "Synthetic rash (example)", severity: "severe", drug_class_code: "DEMO-ALPHA", status: "active" },
  { id: "a5", substance_text: "Demo class Delta agents", reaction: "Synthetic itch (example)", severity: "mild", drug_class_code: "DEMO-DELTA", status: "active" },
];

const PATIENT_MEDS: PatientMedication[] = [
  { id: "m2", dose_text: "5 mg oral once daily", start_date: "2026-02-01", status: "active", source_prescription_id: null, medication: { name: "Morivane", strength: "5 mg", form: "tablet" } },
];

const RULE_ALPHA = "DEMO RULE: recorded allergy to demo class Alpha. Illustrative only, not clinical guidance.";
const RULE_BETA_GAMMA = "DEMO RULE: demo classes Beta and Gamma flagged together. Illustrative only, not clinical guidance.";

function prescription(medication: MedicationOption, overrides: Partial<Prescription> = {}): Prescription {
  return {
    id: "00000000-0000-4000-8000-000000000201",
    patient_id: PATIENT.id,
    medication_id: medication.id,
    prescriber_id: PRESCRIBER,
    dose_amount: 1,
    dose_unit: medication.form === "capsule" ? "capsule" : "tablet",
    route: "oral",
    frequency: "twice_daily",
    quantity: 28,
    refills: 1,
    duration_days: 14,
    start_date: todayUtc(),
    instructions: "Take with water (synthetic example).",
    status: "draft",
    version: 2,
    idempotency_key: "00000000-0000-4000-8000-000000000901",
    last_evaluated_version: 2,
    signed_by: null,
    signed_at: null,
    cancelled_by: null,
    cancelled_at: null,
    cancel_reason: null,
    created_at: "2026-10-19T08:00:00Z",
    updated_at: "2026-10-19T08:05:00Z",
    medication,
    ...overrides,
  };
}

function alert(id: string, severity: PrescriptionAlert["severity"], message: string, decision: PrescriptionAlert["decision"] = null): PrescriptionAlert {
  return {
    id: `00000000-0000-4000-8000-0000000003${id}`,
    severity,
    message,
    prescription_version: 2,
    resolved_at: null,
    allergy_id: severity === "blocking" ? "a1" : null,
    patient_medication_id: severity === "advisory" ? "m2" : null,
    decision,
  };
}

function workspace(rx: Prescription, alerts: PrescriptionAlert[] = [], own = true): PrescriptionWorkspace {
  return {
    patient: PATIENT,
    prescription: rx,
    alerts,
    medications: CATALOG,
    prescriberName: own ? "Dr. Demo Clinician" : "Dr. Other Clinician",
    isOwnPrescription: own,
    allergies: ALLERGIES,
    patientMedications: PATIENT_MEDS,
  };
}

const ACKNOWLEDGED = { id: "00000000-0000-4000-8000-000000000401", reason: "Reviewed with patient (synthetic).", created_at: "2026-10-19T08:10:00Z" };

const WORKSPACES = {
  unevaluated: workspace(prescription(med("Calvexa"), { last_evaluated_version: 1 })),
  blocking: workspace(prescription(med("Zentoril")), [alert("01", "blocking", RULE_ALPHA)]),
  advisory: workspace(prescription(med("Calvexa")), [alert("02", "advisory", RULE_BETA_GAMMA)]),
  // Every alert kind on one version, listed out of order: the review shows blocking first.
  mixed: workspace(prescription(med("Zentoril")), [
    alert("05", "advisory", RULE_BETA_GAMMA, ACKNOWLEDGED),
    alert("06", "advisory", RULE_BETA_GAMMA),
    alert("07", "blocking", RULE_ALPHA),
  ]),
  ready: workspace(prescription(med("Calvexa")), [alert("03", "advisory", RULE_BETA_GAMMA, ACKNOWLEDGED)]),
  signed: workspace(
    prescription(med("Calvexa"), { status: "signed", signed_by: PRESCRIBER, signed_at: "2026-10-19T08:12:00Z" }),
    [alert("04", "advisory", RULE_BETA_GAMMA, ACKNOWLEDGED)],
  ),
  cancelled: workspace(
    prescription(med("Ploxidrin"), {
      status: "cancelled",
      cancelled_by: PRESCRIBER,
      cancelled_at: "2026-10-19T08:20:00Z",
      cancel_reason: "Entered in error (synthetic)",
    }),
  ),
  "other-prescriber": workspace(prescription(med("Tessaline"), { prescriber_id: OTHER_PRESCRIBER, last_evaluated_version: 1 }), [], false),
} satisfies Record<string, PrescriptionWorkspace>;

const VIEWS = ["new", ...Object.keys(WORKSPACES)] as const;
type View = "new" | keyof typeof WORKSPACES;

export default async function PrescribingSpecimenPage({ searchParams }: PageProps<"/dev/prescribing">) {
  if (process.env.NODE_ENV !== "development") notFound();

  const params = await searchParams;
  const view = (VIEWS.find((v) => v === params.view) ?? "new") as View;
  const delay = delayParam(params.delay);
  const skeleton = <PrescribingSkeleton withStatus={view !== "new"} />;

  const content = (
    <>
      {view === "new" ? (
        <NewPrescriptionView
          patient={PATIENT}
          medications={CATALOG}
          allergies={ALLERGIES}
          patientMedications={PATIENT_MEDS}
          idempotencyKey="00000000-0000-4000-8000-000000000999"
          startDate={todayUtc()}
        />
      ) : (
        <PrescriptionView workspace={WORKSPACES[view]} />
      )}
      <p className="mt-6 text-label-sm text-ink-muted">
        Development specimen. Views:{" "}
        {VIEWS.map((v, i) => (
          <span key={v}>
            {i > 0 && " · "}
            <Link href={`/dev/prescribing?view=${v}`} className="underline">
              {v}
            </Link>
          </span>
        ))}
        {" · "}
        <Link href={`/dev/prescribing?view=${view}&skeleton=1`} className="underline">
          skeleton
        </Link>
      </p>
    </>
  );

  return (
    <AppShell user={CLINICIAN} activePath="/patients" searchAction="/dev/shell" searchHiddenFields={{ view: "clinician" }}>
      {params.skeleton ? (
        skeleton
      ) : delay ? (
        <Suspense fallback={skeleton}>
          <Delayed ms={delay}>{content}</Delayed>
        </Suspense>
      ) : (
        content
      )}
    </AppShell>
  );
}
