import Link from "next/link";
import { Avatar, Card, EmptyState, PrivateText, Tag } from "@/components/ui";
import { ageInYears, formatDate } from "@/lib/format";
import { getInitials } from "@/lib/initials";
import type { PatientSummary } from "@/types/domain";

/** The query is usually a name or MRN, so it is masked like one. */
function resultSummary(count: number, query: string) {
  const matches = count === 0 ? "No patients match" : `${count} ${count === 1 ? "patient matches" : "patients match"}`;
  return (
    <>
      {matches} “<PrivateText label="Search text">{query}</PrivateText>”.
    </>
  );
}

/** Care-team patient table (dashboard table-card pattern), optionally narrowed by a search query. */
export function PatientList({
  patients,
  query,
  clearHref = "/patients",
}: {
  patients: PatientSummary[];
  query: string;
  clearHref?: string;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-display text-heading-xl font-medium tracking-tight">My care team patients</h1>
        {query && (
          <p role="status" className="mt-1 text-body-sm text-ink-secondary">
            {resultSummary(patients.length, query)}{" "}
            <Link href={clearHref} className="font-medium text-accent underline underline-offset-2">
              Clear search
            </Link>
          </p>
        )}
      </div>
      <Card>
        {patients.length === 0 ? (
          <EmptyState>
            {query
              ? "No patients on your care teams match this search. Search by name or MRN."
              : "No patients are assigned to your care teams."}
          </EmptyState>
        ) : (
          <table className="w-full text-left text-body-sm">
            <thead>
              <tr>
                <th scope="col" className="label-caps pb-2 pr-4">Patient</th>
                <th scope="col" className="label-caps hidden pb-2 pr-4 md:table-cell">MRN</th>
                <th scope="col" className="label-caps hidden pb-2 pr-4 md:table-cell">Date of birth</th>
                <th scope="col" className="label-caps hidden pb-2 lg:table-cell">Care team</th>
              </tr>
            </thead>
            <tbody>
              {patients.map((patient) => {
                const dob = `${formatDate(patient.date_of_birth)} (${ageInYears(patient.date_of_birth)} y)`;
                return (
                  <tr key={patient.id} className="border-t border-line-subtle">
                    <td className="py-2.5 pr-4">
                      <div className="flex items-center gap-3">
                        <Avatar
                          initials={
                            <PrivateText label="Initials" revealable={false} mask="••">
                              {getInitials(`${patient.given_name} ${patient.family_name}`)}
                            </PrivateText>
                          }
                          size="sm"
                        />
                        <div className="min-w-0">
                          {/* A mask inside a link cannot be a button; the MRN and date of birth can be revealed. */}
                          <Link
                            href={`/patients/${patient.id}`}
                            className="font-medium text-accent underline-offset-2 hover:underline"
                          >
                            <PrivateText label="Patient name" revealable={false}>
                              {`${patient.family_name}, ${patient.given_name}`}
                            </PrivateText>
                          </Link>
                          <p className="text-label-sm text-ink-secondary md:hidden">
                            <span className="font-mono">
                              <PrivateText label="MRN">{patient.mrn}</PrivateText>
                            </span>{" "}
                            · <PrivateText label="Date of birth" className="whitespace-nowrap">{dob}</PrivateText>
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="hidden py-2.5 pr-4 font-mono text-code-sm md:table-cell">
                      <PrivateText label="MRN">{patient.mrn}</PrivateText>
                    </td>
                    <td className="hidden py-2.5 pr-4 md:table-cell">
                      <PrivateText label="Date of birth">{dob}</PrivateText>
                    </td>
                    <td className="hidden py-2.5 lg:table-cell">
                      {patient.care_team && <Tag>{patient.care_team.name}</Tag>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
