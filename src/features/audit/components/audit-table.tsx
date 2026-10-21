import type { ReactNode } from "react";
import { Badge, cn, SkeletonLine } from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import type { AuditEvent } from "@/types/domain";
import { auditText } from "./audit-header";

// One table, two layouts: stacked cards at 760px and below (below `md`), a fixed-layout table above.
// Changing `display` can drop table semantics in some browsers, so the roles are explicit.

const COLUMNS = ["When (UTC)", "Action", "Actor", "Entity", "Patient", "Details"] as const;

function Row({ children }: { children: ReactNode }) {
  return (
    <tr
      role="row"
      className="flex flex-col gap-2 border-t border-line py-3 first:border-t-0 md:table-row md:py-0 md:first:border-t md:align-top"
    >
      {children}
    </tr>
  );
}

function Cell({ label, mono = false, className, children }: { label: string; mono?: boolean; className?: string; children: ReactNode }) {
  return (
    <td role="cell" className={cn("block min-w-0 md:table-cell md:py-2 md:pr-4", mono && "font-mono text-code-sm break-all", className)}>
      <span aria-hidden="true" className="label-caps block md:hidden">
        {label}
      </span>
      {children}
    </td>
  );
}

function Table({ children }: { children: ReactNode }) {
  return (
    <table role="table" className={cn("block w-full text-left md:table md:table-fixed", auditText.table)}>
      <colgroup>
        {COLUMNS.map((column) => (
          <col key={column} className="md:w-1/6" />
        ))}
      </colgroup>
      <thead role="rowgroup" className="label-caps max-md:sr-only">
        <tr role="row">
          {COLUMNS.map((column) => (
            <th key={column} role="columnheader" scope="col" className="py-2 pr-4">
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

/** Audit events, newest first. Identifiers only; metadata never holds clinical content. */
export function AuditTable({ events }: { events: AuditEvent[] }) {
  return (
    <Table>
      {events.map((event) => (
        <Row key={event.id}>
          <Cell label={COLUMNS[0]}>{formatDateTime(event.occurred_at)}</Cell>
          <Cell label={COLUMNS[1]}>
            <Badge tone="accent" className="max-w-full break-all">
              {event.action}
            </Badge>
          </Cell>
          <Cell label={COLUMNS[2]} mono>
            {event.actor_id ?? "system"}
            {event.actor_role && <span className="block text-ink-muted">{event.actor_role}</span>}
          </Cell>
          <Cell label={COLUMNS[3]} mono>
            {event.entity_type}
            <span className="block text-ink-muted">{event.entity_id}</span>
          </Cell>
          <Cell label={COLUMNS[4]} mono>
            {event.patient_id ?? "None"}
          </Cell>
          <Cell label={COLUMNS[5]} mono>
            {JSON.stringify(event.metadata)}
          </Cell>
        </Row>
      ))}
    </Table>
  );
}

/** The same table with placeholder rows, for the loading skeleton (rendered inside `aria-hidden`). */
export function AuditTableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <Table>
      {Array.from({ length: rows }, (_, i) => (
        <Row key={i}>
          <Cell label={COLUMNS[0]}>
            <SkeletonLine width="w-32 max-w-full" />
          </Cell>
          <Cell label={COLUMNS[1]}>
            <SkeletonLine width="w-28 max-w-full" />
          </Cell>
          <Cell label={COLUMNS[2]} mono>
            <SkeletonLine width="w-full" />
            <SkeletonLine width="w-16" />
          </Cell>
          <Cell label={COLUMNS[3]} mono>
            <SkeletonLine width="w-20" />
            <SkeletonLine width="w-full" />
          </Cell>
          <Cell label={COLUMNS[4]} mono>
            <SkeletonLine width="w-full" />
          </Cell>
          <Cell label={COLUMNS[5]} mono>
            <SkeletonLine width="w-full" />
          </Cell>
        </Row>
      ))}
    </Table>
  );
}
