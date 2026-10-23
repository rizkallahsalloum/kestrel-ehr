import { AlertTriangleIcon, Avatar, Badge, PrivateRegion, PrivateText, Tag } from "@/components/ui";
import { allergyTone, highestSeverity } from "@/features/chart/allergies";
import { formatAgeSex, formatDate } from "@/lib/format";
import { getInitials } from "@/lib/initials";
import type { Allergy, PatientSummary } from "@/types/domain";

function AllergyBadge({ allergies }: { allergies: Pick<Allergy, "severity">[] }) {
  const highest = highestSeverity(allergies);
  if (!highest) return <Badge tone="neutral" size="md">No active allergies recorded</Badge>;
  const count = allergies.length;
  const tone = allergyTone(highest);
  return (
    <Badge tone={tone} size="md" className="shrink-0">
      <AlertTriangleIcon className="size-3.5" />
      {count === 1 ? `1 allergy · ${highest}` : `${count} allergies · highest ${highest}`}
    </Badge>
  );
}

const HERO_DIAGNOSES = 3;

/** Dashboard `.hero`: identity, demographics in mono, and context tags. */
export function PatientHero({
  patient,
  allergies,
  diagnoses = [],
}: {
  patient: PatientSummary;
  allergies: Pick<Allergy, "severity">[];
  /** Most recent active diagnoses first; the hero tags the first three. */
  diagnoses?: { id: string; description: string }[];
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-5 rounded-card border border-line-subtle bg-surface px-5 py-5 shadow-level-1 md:px-6.5 md:py-5.5">
      <div className="flex min-w-0 items-center gap-4">
        <Avatar
          initials={
            <PrivateText label="Initials" revealable={false} mask="••">
              {getInitials(`${patient.given_name} ${patient.family_name}`)}
            </PrivateText>
          }
          size="lg"
        />
        <div className="min-w-0">
          <h1 className="mb-1 font-display text-heading-xl font-medium tracking-tight text-ink">
            <PrivateText label="Patient name">{`${patient.family_name}, ${patient.given_name}`}</PrivateText>
          </h1>
          <p className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-code-sm text-ink-strong">
            <span className="whitespace-nowrap">
              <PrivateText label="Age and sex">{formatAgeSex(patient.date_of_birth, patient.sex)}</PrivateText>
              {" · DOB"} <PrivateText label="Date of birth" className="whitespace-nowrap">{formatDate(patient.date_of_birth)}</PrivateText>
            </span>
            <span className="whitespace-nowrap">
              MRN <PrivateText label="MRN" className="whitespace-nowrap">{patient.mrn}</PrivateText>
            </span>
          </p>
          {/* One line whatever the count, so the hero keeps the skeleton's height; the table lists them all.
              Masked as one region: a mask inside a shrink-to-fit tag cannot keep the tag's width. Inline-size
              containment keeps long tags from widening the hero, which would push the allergy badge down. */}
          {diagnoses.length === 0 ? (
            <p className="mt-3 flex gap-2">
              <Tag className="shrink-0">No active diagnoses</Tag>
            </p>
          ) : (
            <PrivateRegion label="Active diagnoses" className="mt-3 contain-inline-size">
              <p className="flex gap-2 overflow-hidden">
                <span className="sr-only">Active diagnoses:</span>
                {diagnoses.slice(0, HERO_DIAGNOSES).map((diagnosis) => (
                  <Tag key={diagnosis.id} className="min-w-0 shrink">
                    <span className="min-w-0 truncate">{diagnosis.description}</span>
                  </Tag>
                ))}
              </p>
            </PrivateRegion>
          )}
          <p className="mt-2 flex flex-wrap gap-2">
            {patient.care_team && <Tag>{patient.care_team.name}</Tag>}
            <Tag>Synthetic record</Tag>
          </p>
        </div>
      </div>
      <AllergyBadge allergies={allergies} />
    </header>
  );
}
