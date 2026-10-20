import type { Metadata } from "next";
import Link from "next/link";
import { Badge, Card, EmptyState } from "@/components/ui";
import { AUDIT_PAGE_SIZE, listAuditEvents, parseBeforeId } from "@/features/audit/queries";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Audit log | Kestrel EHR" };

export default async function AuditPage({ searchParams }: PageProps<"/admin/audit">) {
  const beforeId = parseBeforeId((await searchParams).before);
  const events = await listAuditEvents(beforeId);
  const oldest = events.at(-1);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Audit log</h1>
      <p className="text-sm text-ink-secondary">
        Read-only, append-only record of synthetic clinical activity. Identifiers only; no clinical content is stored
        in audit metadata.
      </p>
      <Card>
        {events.length === 0 ? (
          <EmptyState>No audit events.</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-ink-muted">
                <tr>
                  <th scope="col" className="py-2 pr-4 font-medium">When (UTC)</th>
                  <th scope="col" className="py-2 pr-4 font-medium">Action</th>
                  <th scope="col" className="py-2 pr-4 font-medium">Actor</th>
                  <th scope="col" className="py-2 pr-4 font-medium">Entity</th>
                  <th scope="col" className="py-2 pr-4 font-medium">Patient</th>
                  <th scope="col" className="py-2 pr-4 font-medium">Details</th>
                </tr>
              </thead>
              <tbody>
                {events.map((event) => (
                  <tr key={event.id} className="border-t border-line align-top">
                    <td className="py-2 pr-4 whitespace-nowrap">{formatDateTime(event.occurred_at)}</td>
                    <td className="py-2 pr-4">
                      <Badge tone="accent">{event.action}</Badge>
                    </td>
                    <td className="py-2 pr-4 font-mono text-xs">
                      {event.actor_id ?? "system"}
                      {event.actor_role && <span className="block text-ink-muted">{event.actor_role}</span>}
                    </td>
                    <td className="py-2 pr-4 font-mono text-xs">
                      {event.entity_type}
                      <span className="block text-ink-muted">{event.entity_id}</span>
                    </td>
                    <td className="py-2 pr-4 font-mono text-xs">{event.patient_id ?? ""}</td>
                    <td className="py-2 pr-4 font-mono text-xs break-all">{JSON.stringify(event.metadata)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <nav className="flex gap-4 text-sm" aria-label="Audit pagination">
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
