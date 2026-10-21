import type { Metadata } from "next";
import { AuditLogView } from "@/features/audit/components/audit-log-view";
import { AUDIT_PAGE_SIZE, listAuditEvents, parseBeforeId } from "@/features/audit/queries";

export const metadata: Metadata = { title: "Audit log | Kestrel EHR" };

export default async function AuditPage({ searchParams }: PageProps<"/admin/audit">) {
  const beforeId = parseBeforeId((await searchParams).before);
  const events = await listAuditEvents(beforeId);
  const oldest = events.at(-1);

  return (
    <AuditLogView
      events={events}
      newerHref={beforeId !== null ? "/admin/audit" : null}
      olderHref={oldest && events.length === AUDIT_PAGE_SIZE ? `/admin/audit?before=${oldest.id}` : null}
    />
  );
}
