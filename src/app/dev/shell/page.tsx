import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LoginForm } from "@/app/(auth)/login/login-form";
import NotFound from "@/app/not-found";
import { AppShell, type ShellUser } from "@/components/shell/app-shell";
import { Card, EmptyState } from "@/components/ui";
import { LoginCard } from "@/features/auth/components/login-card";
import { PatientList } from "@/features/patients/components/patient-list";
import { filterPatients, parsePatientQuery } from "@/features/patients/search";
import type { PatientSummary } from "@/types/domain";
import { ErrorDemo } from "./demos";

export const metadata: Metadata = { title: "Shell specimen (development only) | Kestrel EHR" };

// Static synthetic content for reviewing the Phase 3 shell and simple pages. No data access.

const CLINICIAN: ShellUser = { fullName: "Dr. Demo Clinician", role: "clinician" };
const ADMIN: ShellUser = { fullName: "Demo Administrator", role: "admin" };

const team = { name: "North team (synthetic)" };
const DEMO_PATIENTS: PatientSummary[] = [
  { id: "00000000-0000-4000-8000-000000000101", mrn: "SYN-000101", given_name: "Rowan", family_name: "Testcase", date_of_birth: "1959-03-14", sex: "female", care_team: team },
  { id: "00000000-0000-4000-8000-000000000102", mrn: "SYN-000102", given_name: "Mira", family_name: "Demoson", date_of_birth: "1984-11-02", sex: "female", care_team: team },
  { id: "00000000-0000-4000-8000-000000000103", mrn: "SYN-000103", given_name: "Ellis", family_name: "Placeholder", date_of_birth: "1971-06-27", sex: "male", care_team: team },
  { id: "00000000-0000-4000-8000-000000000104", mrn: "SYN-000104", given_name: "Zoë", family_name: "Sampleton", date_of_birth: "2001-01-09", sex: "female", care_team: team },
];

const VIEWS = ["clinician", "admin", "login", "not-found", "error"] as const;
type View = (typeof VIEWS)[number];

export default async function ShellSpecimenPage({ searchParams }: PageProps<"/dev/shell">) {
  if (process.env.NODE_ENV !== "development") notFound();

  const params = await searchParams;
  const view: View = VIEWS.find((v) => v === params.view) ?? "clinician";
  const query = parsePatientQuery(params.q);

  if (view === "login") {
    return (
      <LoginCard>
        <LoginForm />
      </LoginCard>
    );
  }
  if (view === "not-found") return <NotFound />;
  if (view === "error") return <ErrorDemo />;

  if (view === "admin") {
    return (
      <AppShell user={ADMIN} activePath="/admin/audit">
        <div className="flex flex-col gap-4">
          <h1 className="font-display text-heading-xl font-medium tracking-tight">Audit log</h1>
          <Card>
            <EmptyState>
              Specimen placeholder. Open the{" "}
              <Link href="/dev/audit" className="underline">
                table specimen
              </Link>{" "}
              for the real layout.
            </EmptyState>
          </Card>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      user={CLINICIAN}
      activePath="/patients"
      searchAction="/dev/shell"
      searchHiddenFields={{ view: "clinician" }}
    >
      <PatientList
        patients={filterPatients(DEMO_PATIENTS, query)}
        query={query}
        clearHref="/dev/shell?view=clinician"
      />
      <p className="mt-6 text-label-sm text-ink-muted">
        Development specimen. Views:{" "}
        {VIEWS.map((v, i) => (
          <span key={v}>
            {i > 0 && " · "}
            <Link href={`/dev/shell?view=${v}`} className="underline">
              {v}
            </Link>
          </span>
        ))}
      </p>
    </AppShell>
  );
}
