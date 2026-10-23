import Link from "next/link";
import type { ReactNode } from "react";
import {
  AlertTriangleIcon,
  Avatar,
  Badge,
  cn,
  PrivateText,
  severityFill,
  severityIconText,
  severityOutline,
  severityText,
  Tag,
} from "@/components/ui";
import { medicationLabel } from "@/features/chart/alerts";
import { allergyTone, bySeverity, highestSeverity } from "@/features/chart/allergies";
import { prescriptionStatusTone } from "@/features/chart/components/clinical-lists";
import { patientPath } from "@/features/patients/refs";
import { formatAgeSex, formatDate } from "@/lib/format";
import { getInitials } from "@/lib/initials";
import type { Allergy, PatientMedication, PatientSummary, PrescriptionStatus } from "@/types/domain";
import type { SafetyState } from "../workspace";

// Revised E-Rx layout. Hook-free, so both the server pages and the client draft workspace use it.

/** Three columns above 1280px; context + form with the review below up to 1280px; one column at 820px and below. */
export function ErxGrid({ context, main, review }: { context: ReactNode; main: ReactNode; review: ReactNode }) {
  return (
    <div className="grid items-start gap-5 erx:grid-cols-erx erx-wide:grid-cols-erx-wide">
      <aside aria-label="Patient safety context" className="flex min-w-0 flex-col gap-4">
        {context}
      </aside>
      <div className="flex min-w-0 flex-col gap-4">{main}</div>
      <div className="min-w-0 erx:col-span-full erx-wide:sticky erx-wide:top-below-topbar erx-wide:col-span-1">
        {review}
      </div>
    </div>
  );
}

export function ErxPageHeading({
  patientRef,
  title,
  status,
}: {
  patientRef: string;
  title: ReactNode;
  status?: PrescriptionStatus;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <Link
          href={patientPath(patientRef)}
          className="text-label text-ink-secondary underline underline-offset-2"
        >
          Back to chart
        </Link>
        <h1 className="mt-1 text-heading-xl font-semibold text-ink">{title}</h1>
      </div>
      {status && (
        <Badge tone={prescriptionStatusTone[status]} className="capitalize">
          {status}
        </Badge>
      )}
    </div>
  );
}

const tileTones = {
  neutral: { box: "border border-line-subtle bg-surface-warm", title: "text-ink" },
  warning: { box: `${severityOutline.warning} ${severityFill.warning}`, title: severityText.warning },
  critical: { box: `${severityOutline.critical} ${severityFill.critical}`, title: severityText.critical },
} as const;

function Tile({ tone, title, children }: { tone: keyof typeof tileTones; title: string; children: ReactNode }) {
  return (
    <div
      data-severity={tone === "neutral" ? undefined : tone}
      className={cn("max-w-75 min-w-0 flex-1 basis-55 rounded-panel px-3.5 py-2.5", tileTones[tone].box)}
    >
      <p className={cn("flex items-center gap-1.5 text-label font-semibold", tileTones[tone].title)}>
        {tone !== "neutral" && <AlertTriangleIcon className={severityIconText[tone]} />}
        {title}
      </p>
      <p className="mt-0.5 text-label text-ink-strong">{children}</p>
    </div>
  );
}

function AllergyTile({ allergies }: { allergies: Allergy[] }) {
  const highest = highestSeverity(allergies);
  if (!highest) return <Tile tone="neutral" title="Allergies">No active allergies recorded</Tile>;
  const severe = allergies.filter((a) => a.severity === "severe");
  const shown = severe.length > 0 ? severe : bySeverity(allergies);
  return (
    <Tile
      tone={allergyTone(highest)}
      title={severe.length > 0 ? `Severe allergy${severe.length === 1 ? "" : "s"}` : `Allergies (highest ${highest})`}
    >
      {shown.map((a) => a.substance_text).join("; ")}
    </Tile>
  );
}

/** E-Rx `.hdr`: identity plus summary tiles built from the real allergy and medication lists. */
export function RxPatientHeader({
  patient,
  allergies,
  medications,
}: {
  patient: PatientSummary;
  allergies: Allergy[];
  medications: PatientMedication[];
}) {
  return (
    <section
      aria-label="Patient"
      className="grid items-center gap-x-6 gap-y-4 rounded-card border border-line-subtle bg-surface px-5.5 py-4.5 erx-wide:grid-cols-rx-header"
    >
      <div className="flex min-w-0 items-center gap-4">
        <Avatar
          initials={
            <PrivateText label="Initials" revealable={false} mask="••">
              {getInitials(`${patient.given_name} ${patient.family_name}`)}
            </PrivateText>
          }
          size="md"
        />
        <div className="min-w-0">
          <h2 className="text-heading-md font-semibold text-ink">
            <PrivateText label="Patient name">{`${patient.family_name}, ${patient.given_name}`}</PrivateText>
          </h2>
          <p className="mt-0.5 mb-1.5 flex flex-wrap gap-x-4 font-mono text-code-sm text-ink-strong">
            <span className="whitespace-nowrap">
              <PrivateText label="Age and sex">{formatAgeSex(patient.date_of_birth, patient.sex)}</PrivateText>
              {" · DOB"} <PrivateText label="Date of birth" className="whitespace-nowrap">{formatDate(patient.date_of_birth)}</PrivateText>
            </span>
            <span className="whitespace-nowrap">
              MRN <PrivateText label="MRN" className="whitespace-nowrap">{patient.mrn}</PrivateText>
            </span>
          </p>
          <p className="flex flex-wrap gap-1.5">
            {patient.care_team && <Tag>{patient.care_team.name}</Tag>}
            <Tag>Synthetic record</Tag>
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-3 erx-wide:justify-end">
        <AllergyTile allergies={allergies} />
        <Tile tone="neutral" title="Active medications">
          {medications.length > 0 ? (
            <PrivateText label="Active medications" block>
              {medications.map(medicationLabel).join("; ")}
            </PrivateText>
          ) : (
            "None recorded"
          )}
        </Tile>
      </div>
    </section>
  );
}

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

const summaryTones = {
  neutral: "border border-line bg-surface-warm text-ink",
  ok: "border border-ok bg-ok-subtle text-ok",
  warning: `${severityOutline.warning} ${severityFill.warning} ${severityText.warning}`,
  critical: `${severityOutline.critical} ${severityFill.critical} ${severityText.critical}`,
} as const;

function summaryOf(state: SafetyState): { tone: keyof typeof summaryTones; title: string; detail: string } {
  if (state.kind === "unsaved") {
    return { tone: "neutral", title: "Not saved yet", detail: "Create the draft to run the demo safety check." };
  }
  if (state.kind === "unchecked") {
    return { tone: "neutral", title: "Safety check not run", detail: "The saved version has not been checked." };
  }
  const acknowledged = `${state.acknowledged} acknowledged`;
  if (state.blocking > 0) {
    return { tone: "critical", title: plural(state.blocking, "blocking alert"), detail: "Change the medication or cancel the draft." };
  }
  if (state.advisoryPending > 0) {
    return { tone: "warning", title: `${plural(state.advisoryPending, "advisory alert")} to acknowledge`, detail: acknowledged };
  }
  return { tone: "ok", title: "No open demo alerts", detail: acknowledged };
}

/** Left-column "Medication safety" card: real unresolved alerts on the saved version. */
export function RxSafetySummary({ state }: { state: SafetyState }) {
  const summary = summaryOf(state);
  const severe = summary.tone === "critical" || summary.tone === "warning" ? summary.tone : null;
  return (
    <section className="rounded-card border border-line-subtle bg-surface px-5 py-4">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h2 className="text-heading-sm font-semibold text-ink">Medication safety</h2>
        <span className="text-label-sm text-ink-muted">Saved version</span>
      </div>
      <div data-severity={severe ?? undefined} className={cn("rounded-panel px-4 py-3 text-label", summaryTones[summary.tone])}>
        <p className="flex items-center gap-1.5 font-semibold">
          {severe && <AlertTriangleIcon className={severityIconText[severe]} />}
          {summary.title}
        </p>
        <p className="text-ink-strong">{summary.detail}</p>
      </div>
    </section>
  );
}

// Every pill carries an emphasis-width border so the blocking outline does not change its size.
const countTones = {
  neutral: "border-transparent bg-on-inverse/12 text-on-inverse",
  ok: "border-transparent bg-ok text-on-accent",
  warning: "border-transparent bg-warning-subtle text-warning",
  critical: "border-danger bg-danger-subtle text-danger-ink",
} as const;

export function reviewCount(state: SafetyState): { tone: keyof typeof countTones; text: string } {
  if (state.kind === "unsaved") return { tone: "neutral", text: "Not saved" };
  if (state.kind === "unchecked") return { tone: "neutral", text: "Not checked" };
  if (state.blocking > 0) return { tone: "critical", text: `${state.blocking} blocking` };
  if (state.advisoryPending > 0) return { tone: "warning", text: `${state.advisoryPending} to acknowledge` };
  return { tone: "ok", text: "All addressed" };
}

/** E-Rx `.rev`: dark header with a status pill over the review body. */
export function ReviewShell({
  title,
  subtitle,
  count,
  children,
}: {
  title: string;
  subtitle: string;
  count: { tone: keyof typeof countTones; text: string };
  children: ReactNode;
}) {
  return (
    <section
      id="rx-review"
      tabIndex={-1}
      aria-labelledby="rx-review-title"
      className="overflow-hidden rounded-card border border-line-subtle bg-surface shadow-level-1"
    >
      <header className="flex flex-wrap items-center justify-between gap-3 bg-inverse px-5 py-4">
        <div className="min-w-0">
          <h2 id="rx-review-title" className="text-heading-sm font-semibold text-on-inverse">
            {title}
          </h2>
          <p className="text-label-sm text-on-inverse-muted">{subtitle}</p>
        </div>
        <span
          data-severity={count.tone === "critical" || count.tone === "warning" ? count.tone : undefined}
          className={cn(
            "inline-flex items-center gap-1 rounded-pill border-(length:--border-width-emphasis) px-2.5 py-0.5 text-label-sm font-medium whitespace-nowrap",
            countTones[count.tone],
          )}
        >
          {(count.tone === "critical" || count.tone === "warning") && <AlertTriangleIcon className="size-3.5" />}
          {count.text}
        </span>
      </header>
      <div className="flex flex-col gap-4 px-5 py-4">{children}</div>
    </section>
  );
}
