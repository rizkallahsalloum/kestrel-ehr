import type { ReactNode } from "react";
import { Badge, Card, cn, EmptyState, PrivateText, SkeletonBlock, SkeletonLine } from "@/components/ui";
import { formatDate } from "@/lib/format";
import type { DiagnosisItem } from "../queries";
import { DiagnosisRowActions } from "./diagnosis-row-actions";

// One table, two layouts (the audit table's pattern): stacked rows at 760px and below, a table
// above. Changing `display` can drop table semantics in some browsers, so the roles are explicit.

export const DIAGNOSIS_COLUMNS = ["ICD-10-CM", "Diagnosis", "Status", "Recorded", "Actions"] as const;

/** Fixed layout: column widths never depend on the content, so Privacy masks cannot move them. */
const COLUMN_WIDTHS = ["md:w-1/6", undefined, "md:w-1/6", "md:w-1/6", "md:w-1/5"] as const;

export function DiagnosisTableFrame({ children }: { children: ReactNode }) {
  return (
    <table role="table" aria-label="Diagnoses" className="block w-full text-left text-body-sm md:table md:table-fixed">
      <colgroup>
        {COLUMN_WIDTHS.map((width, i) => (
          <col key={DIAGNOSIS_COLUMNS[i]} className={width} />
        ))}
      </colgroup>
      <thead role="rowgroup" className="label-caps max-md:sr-only">
        <tr role="row">
          {DIAGNOSIS_COLUMNS.map((column) => (
            <th key={column} role="columnheader" scope="col" className="pr-4 pb-2 last:pr-0">
              {column}
            </th>
          ))}
        </tr>
      </thead>
      <tbody role="rowgroup" className="block md:table-row-group">
        {children}
      </tbody>
    </table>
  );
}

export function DiagnosisRow({ children }: { children: ReactNode }) {
  return (
    <tr
      role="row"
      className="flex flex-col gap-2 border-t border-line-subtle py-3 md:table-row md:py-0 md:align-top"
    >
      {children}
    </tr>
  );
}

export function DiagnosisCell({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <td role="cell" className={cn("block min-w-0 md:table-cell md:py-3 md:pr-4 md:last:pr-0", className)}>
      <span aria-hidden="true" className="label-caps block md:hidden">
        {label}
      </span>
      {children}
    </td>
  );
}

export const DIAGNOSES_TITLE = "Diagnoses";
export const DIAGNOSES_DESCRIPTION =
  "Synthetic problem list with ICD-10-CM codes. Changes are versioned and recorded in the audit log.";

/** The card with three placeholder rows, for the chart skeleton (rendered inside `aria-hidden`). */
export function DiagnosisTableSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="rounded-card border border-line-subtle bg-surface p-5 shadow-level-1">
      <div className="mb-3">
        <p className="text-heading-sm font-semibold text-ink">{DIAGNOSES_TITLE}</p>
        <p className="mt-0.5 text-label-sm text-ink-muted">{DIAGNOSES_DESCRIPTION}</p>
      </div>
      <DiagnosisTableFrame>
        {Array.from({ length: rows }, (_, i) => (
          <DiagnosisRow key={i}>
            <DiagnosisCell label={DIAGNOSIS_COLUMNS[0]}>
              <SkeletonLine className="text-code-sm" width="w-14" />
            </DiagnosisCell>
            <DiagnosisCell label={DIAGNOSIS_COLUMNS[1]}>
              <SkeletonLine width="w-48 max-w-full" />
            </DiagnosisCell>
            <DiagnosisCell label={DIAGNOSIS_COLUMNS[2]}>
              <SkeletonLine className="text-caption" width="w-14" />
            </DiagnosisCell>
            <DiagnosisCell label={DIAGNOSIS_COLUMNS[3]}>
              <SkeletonLine width="w-24" />
              <SkeletonLine className="text-label-sm" width="w-28" />
            </DiagnosisCell>
            <DiagnosisCell label={DIAGNOSIS_COLUMNS[4]}>
              <SkeletonBlock className="min-h-control-sm w-36 rounded-pill" />
            </DiagnosisCell>
          </DiagnosisRow>
        ))}
      </DiagnosisTableFrame>
    </div>
  );
}

/**
 * The patient's problem list: active diagnoses first. Any clinician on the care team can resolve,
 * reopen or edit; every change is versioned, kept as a revision and written to the audit log.
 */
export function DiagnosisTable({ diagnoses }: { diagnoses: DiagnosisItem[] }) {
  return (
    <Card elevated title={DIAGNOSES_TITLE} description={DIAGNOSES_DESCRIPTION}>
      {diagnoses.length === 0 ? (
        <EmptyState>No diagnoses recorded.</EmptyState>
      ) : (
        <DiagnosisTableFrame>
          {diagnoses.map((diagnosis) => (
            <DiagnosisRow key={diagnosis.id}>
              <DiagnosisCell label={DIAGNOSIS_COLUMNS[0]} className="font-mono text-code-sm whitespace-nowrap">
                <PrivateText label="ICD-10-CM code">{diagnosis.icd10_code}</PrivateText>
              </DiagnosisCell>
              <DiagnosisCell label={DIAGNOSIS_COLUMNS[1]} className="font-medium text-ink">
                <PrivateText label="Diagnosis" block>
                  {diagnosis.description}
                </PrivateText>
              </DiagnosisCell>
              <DiagnosisCell label={DIAGNOSIS_COLUMNS[2]}>
                <Badge tone={diagnosis.status === "active" ? "accent" : "neutral"} className="capitalize">
                  {diagnosis.status}
                </Badge>
                {diagnosis.resolved_on && (
                  <p className="mt-1 text-label-sm text-ink-secondary">
                    on <PrivateText label="Resolved date" className="whitespace-nowrap">{formatDate(diagnosis.resolved_on)}</PrivateText>
                  </p>
                )}
              </DiagnosisCell>
              <DiagnosisCell label={DIAGNOSIS_COLUMNS[3]} className="text-ink-strong">
                <PrivateText label="Recorded date" className="whitespace-nowrap">{formatDate(diagnosis.recorded_on)}</PrivateText>
                {diagnosis.recorder && (
                  <p className="text-label-sm text-ink-secondary">by {diagnosis.recorder.full_name}</p>
                )}
              </DiagnosisCell>
              <DiagnosisCell label={DIAGNOSIS_COLUMNS[4]}>
                <DiagnosisRowActions
                  target={{
                    id: diagnosis.id,
                    code: diagnosis.icd10_code,
                    description: diagnosis.description,
                    status: diagnosis.status,
                    version: diagnosis.version,
                  }}
                />
              </DiagnosisCell>
            </DiagnosisRow>
          ))}
        </DiagnosisTableFrame>
      )}
    </Card>
  );
}
