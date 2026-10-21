import Link from "next/link";
import { Card, EmptyState } from "@/components/ui";
import type { AuditEvent } from "@/types/domain";
import { AuditIntro, auditText } from "./audit-header";
import { AuditTable } from "./audit-table";

/** Audit log page body. Data access stays in the route; this only renders what it is given. */
export function AuditLogView({
  events,
  newerHref,
  olderHref,
}: {
  events: AuditEvent[];
  newerHref: string | null;
  olderHref: string | null;
}) {
  return (
    <div className="flex flex-col gap-4">
      <h1 className={auditText.heading}>Audit log</h1>
      <AuditIntro />
      <Card>{events.length === 0 ? <EmptyState>No audit events.</EmptyState> : <AuditTable events={events} />}</Card>
      <nav className="flex gap-4 text-label" aria-label="Audit pagination">
        {newerHref && (
          <Link href={newerHref} className="text-accent underline">
            Newest events
          </Link>
        )}
        {olderHref && (
          <Link href={olderHref} className="text-accent underline">
            Older events
          </Link>
        )}
      </nav>
    </div>
  );
}
