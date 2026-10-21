import type { Metadata } from "next";
import Link from "next/link";
import { Badge, Card, cn, EmptyState } from "@/components/ui";
import { AuditIntro, auditText } from "@/features/audit/components/audit-header";
import { AUDIT_PAGE_SIZE, listAuditEvents, parseBeforeId } from "@/features/audit/queries";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Audit log | Kestrel EHR" };

export default async function AuditPage({ searchParams }: PageProps<"/admin/audit">) {
  const beforeId = parseBeforeId((await searchParams).before);
  const events = await listAuditEvents(beforeId);
  const oldest = events.at(-1);

  return (
    <div className="flex flex-col gap-4">
      <h1 className={auditText.heading}>Audit log</h1>
      <AuditIntro />
      <Card>
        {events.length === 0 ? (
          <EmptyState>No audit events.</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className={cn("w-full text-left", auditText.table)}>
              <thead className="label-caps">
                <tr>
                  <th scope="col" className="py-2 pr-4">When (UTC)</th>
                  <th scope="col" className="py-2 pr-4">Action</th>
                  <th scope="col" className="py-2 pr-4">Actor</th>
                  <th scope="col" className="py-2 pr-4">Entity</th>
                  <th scope="col" className="py-2 pr-4">Patient</th>
                  <th scope="col" className="py-2 pr-4">Details</th>
                </tr>
              </thead>
              <tbody>
                {events.map((event) => (
                  <tr key={event.id} className="border-t border-line align-top">
                    <td className="py-2 pr-4 whitespace-nowrap">{formatDateTime(event.occurred_at)}</td>
                    <td className="py-2 pr-4">
                      <Badge tone="accent">{event.action}</Badge>
                    </td>
                    <td className="py-2 pr-4 font-mono text-code-sm">
                      {event.actor_id ?? "system"}
                      {event.actor_role && <span className="block text-ink-muted">{event.actor_role}</span>}
                    </td>
                    <td className="py-2 pr-4 font-mono text-code-sm">
                      {event.entity_type}
                      <span className="block text-ink-muted">{event.entity_id}</span>
                    </td>
                    <td className="py-2 pr-4 font-mono text-code-sm">{event.patient_id ?? ""}</td>
                    <td className="py-2 pr-4 font-mono text-code-sm break-all">{JSON.stringify(event.metadata)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <nav className="flex gap-4 text-label" aria-label="Audit pagination">
        {beforeId !== null && (
          <Link href="/admin/audit" className="text-accent underline">
            Newest events
          </Link>
        )}
        {oldest && events.length === AUDIT_PAGE_SIZE && (
          <Link href={`/admin/audit?before=${oldest.id}`} className="text-accent underline">
            Older events
          </Link>
        )}
      </nav>
    </div>
  );
}
