import { LoadingRegion, SkeletonBlock, SkeletonLine } from "@/components/ui";

/** Mirrors PatientList: the same heading and card, with placeholder rows. */
export function PatientListSkeleton() {
  return (
    <LoadingRegion label="Loading patients" className="flex flex-col gap-4">
      <p className="font-display text-heading-xl font-medium tracking-tight">My care team patients</p>
      <div className="rounded-card border border-line-subtle bg-surface p-5">
        <div className="pb-2">
          <SkeletonLine className="label-caps" width="w-20" />
        </div>
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center gap-3 border-t border-line-subtle py-2.5 text-body-sm">
            <SkeletonBlock className="size-7.5 shrink-0 rounded-full" />
            <SkeletonLine className="min-w-0 flex-1" width="w-48 max-w-full" />
          </div>
        ))}
      </div>
    </LoadingRegion>
  );
}
