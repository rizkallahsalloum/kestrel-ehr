import { PrivateText, SkeletonLine } from "@/components/ui";
import { formatAgeSex, formatDate } from "@/lib/format";
import type { PatientSummary } from "@/types/domain";

// Who this page is about, kept in view for the wrong-patient check. Masked in Privacy mode like the
// hero, but not revealable here (no tab stops): the hero and the E-Rx header reveal each value.

const STRIP =
  "sticky top-topbar-bottom z-10 -mx-md -mt-lg mb-lg flex flex-col border-b border-line-subtle bg-page px-md py-xs md:-mx-lg md:flex-row md:items-center md:gap-x-md md:px-lg";

function patientName(patient: PatientSummary): string {
  return `${patient.family_name}, ${patient.given_name}`;
}

/**
 * Slim strip under the sticky top bar on patient pages: name, age and sex, DOB (from 761px) and
 * MRN. Two lines at 760px and below; the name wraps, never truncates. Its height feeds the sticky
 * offsets and scroll padding (`--patient-strip` in globals.css).
 */
export function PatientContextStrip({ patient }: { patient: PatientSummary }) {
  return (
    <section aria-label="Patient context" data-patient-strip="" className={STRIP}>
      <p className="text-label font-semibold text-ink">
        <PrivateText label="Patient name" revealable={false}>
          {patientName(patient)}
        </PrivateText>
      </p>
      <p className="flex flex-wrap gap-x-md font-mono text-code-sm text-ink-strong">
        <span className="whitespace-nowrap">
          <PrivateText label="Age and sex" revealable={false}>
            {formatAgeSex(patient.date_of_birth, patient.sex)}
          </PrivateText>
          <span className="hidden md:inline">
            {" · DOB "}
            <PrivateText label="Date of birth" revealable={false}>
              {formatDate(patient.date_of_birth)}
            </PrivateText>
          </span>
        </span>
        <span className="whitespace-nowrap">
          MRN{" "}
          <PrivateText label="MRN" revealable={false}>
            {patient.mrn}
          </PrivateText>
        </span>
      </p>
    </section>
  );
}

/** The strip's box for route skeletons that draw before the patient is known. */
export function PatientContextStripSkeleton() {
  return (
    <div aria-hidden="true" data-patient-strip="skeleton" className={STRIP}>
      <SkeletonLine className="text-label" width="w-40" />
      <SkeletonLine className="text-code-sm" width="w-48" />
    </div>
  );
}

/** Identity next to the Sign action in the E-Rx review panel, DOB included. */
export function SigningFor({ patient }: { patient: PatientSummary }) {
  return (
    <div data-signing-for="" className="rounded-panel border border-line-subtle bg-surface-warm px-3.5 py-2.5">
      <p className="text-label-sm text-ink-secondary">Signing for</p>
      <p className="text-label font-semibold text-ink">
        <PrivateText label="Patient name" revealable={false}>
          {patientName(patient)}
        </PrivateText>
      </p>
      <p className="flex flex-wrap gap-x-md font-mono text-code-sm text-ink-strong">
        <span className="whitespace-nowrap">
          <PrivateText label="Age and sex" revealable={false}>
            {formatAgeSex(patient.date_of_birth, patient.sex)}
          </PrivateText>
          {" · DOB "}
          <PrivateText label="Date of birth" revealable={false}>
            {formatDate(patient.date_of_birth)}
          </PrivateText>
        </span>
        <span className="whitespace-nowrap">
          MRN{" "}
          <PrivateText label="MRN" revealable={false}>
            {patient.mrn}
          </PrivateText>
        </span>
      </p>
    </div>
  );
}
