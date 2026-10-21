import { Card, LoadingRegion } from "@/components/ui";
import { AuditIntro, auditText } from "./audit-header";
import { AuditTableSkeleton } from "./audit-table";

/** Mirrors AuditLogView: heading, intro and the table card, stacked or tabular at the same width. */
export function AuditSkeleton() {
  return (
    <LoadingRegion label="Loading audit log" className="flex flex-col gap-4">
      <p className={auditText.heading}>Audit log</p>
      <AuditIntro />
      <Card>
        <AuditTableSkeleton />
      </Card>
    </LoadingRegion>
  );
}
