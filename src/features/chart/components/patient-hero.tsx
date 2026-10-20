import { Avatar, Badge, initialsOf, severityIcons, Tag } from "@/components/ui";
import { allergyTone, highestSeverity } from "@/features/chart/allergies";
import { ageInYears, formatDate } from "@/lib/format";
import type { Allergy, PatientSummary } from "@/types/domain";

const SEX_SHORT: Record<string, string> = { female: "F", male: "M" };

function AllergyBadge({ allergies }: { allergies: Pick<Allergy, "severity">[] }) {
  const highest = highestSeverity(allergies);
  if (!highest) return <Badge tone="neutral">No active allergies recorded</Badge>;
  const count = allergies.length;
  const tone = allergyTone(highest);
  const Icon = severityIcons[tone];
  return (
    <Badge tone={tone} className="gap-1">
      <Icon className="size-3.5" />
      {count === 1 ? `1 allergy · ${highest}` : `${count} allergies · highest ${highest}`}
    </Badge>
  );
}

/** Dashboard `.hero`: identity, demographics in mono, and context tags. */
export function PatientHero({ patient, allergies }: { patient: PatientSummary; allergies: Pick<Allergy, "severity">[] }) {
  const sex = SEX_SHORT[patient.sex] ?? patient.sex;
  return (
    <header className="flex flex-wrap items-start justify-between gap-5 rounded-card border border-line-subtle bg-surface px-5 py-5 shadow-level-1 md:px-6.5 md:py-5.5">
      <div className="flex min-w-0 items-center gap-4">
        <Avatar initials={initialsOf(patient.given_name, patient.family_name)} size="lg" />
        <div className="min-w-0">
          <h1 className="mb-1 font-display text-heading-xl font-medium tracking-tight text-ink">
            {patient.family_name}, {patient.given_name}
          </h1>
          <p className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-code-sm text-ink-strong">
            <span className="whitespace-nowrap">
              {ageInYears(patient.date_of_birth)}
              <abbr title={patient.sex} className="no-underline">
                {sex}
              </abbr>{" "}
              · DOB {formatDate(patient.date_of_birth)}
            </span>
            <span className="whitespace-nowrap">MRN {patient.mrn}</span>
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
