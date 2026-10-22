import { AlertTriangleIcon, Avatar, Badge, PrivateText, Tag } from "@/components/ui";
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

/** Dashboard `.hero`: identity, demographics in mono, and context tags. */
export function PatientHero({ patient, allergies }: { patient: PatientSummary; allergies: Pick<Allergy, "severity">[] }) {
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
          <p className="mt-3 flex flex-wrap gap-2">
            {patient.care_team && <Tag>{patient.care_team.name}</Tag>}
            <Tag>Synthetic record</Tag>
          </p>
        </div>
      </div>
      <AllergyBadge allergies={allergies} />
    </header>
  );
}
