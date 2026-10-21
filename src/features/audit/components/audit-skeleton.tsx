import { cn, LoadingRegion, SkeletonLine } from "@/components/ui";
import { AuditIntro, auditText } from "./audit-header";

/** Mirrors the audit log page: heading, intro and the table card with placeholder rows. */
export function AuditSkeleton() {
  return (
    <LoadingRegion label="Loading audit log" className="flex flex-col gap-4">
      <p className={auditText.heading}>Audit log</p>
      <AuditIntro />
      <div className={cn("rounded-card border border-line-subtle bg-surface p-5", auditText.table)}>
        <div className="py-2">
          <SkeletonLine className="label-caps" width="w-64 max-w-full" />
        </div>
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="border-t border-line py-2">
            <SkeletonLine width="w-full" />
          </div>
        ))}
      </div>
    </LoadingRegion>
  );
}
