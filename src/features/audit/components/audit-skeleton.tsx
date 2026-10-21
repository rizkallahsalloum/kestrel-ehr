import { LoadingRegion, SkeletonLine } from "@/components/ui";

/** Mirrors the audit log page: heading, intro and the table card with placeholder rows. */
export function AuditSkeleton() {
  return (
    <LoadingRegion label="Loading audit log" className="flex flex-col gap-4">
      <p className="text-xl font-semibold">Audit log</p>
      <p className="text-sm text-ink-secondary">
        Read-only, append-only record of synthetic clinical activity. Identifiers only; no clinical content is stored
        in audit metadata.
      </p>
      <div className="rounded-card border border-line-subtle bg-surface p-5 text-sm">
        <div className="py-2">
          <SkeletonLine width="w-64 max-w-full" />
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
