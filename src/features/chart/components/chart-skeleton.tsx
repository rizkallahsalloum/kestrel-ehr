import { cn, LoadingRegion, SkeletonBlock, SkeletonLine } from "@/components/ui";

// Mirrors PatientChartView: same grid, card boxes and line heights, so the swap to the real chart
// keeps the columns and the hero in place. Rows stand in for typical content.

function TagSkeleton({ width }: { width: string }) {
  return (
    <span className="inline-flex rounded-pill border border-line-subtle bg-surface-warm px-2.5 py-0.5 text-label-sm">
      <SkeletonLine width={width} />
    </span>
  );
}

/** Age and DOB, then MRN: two unbreakable runs that wrap onto separate lines on narrow screens. */
export function DemographicsSkeleton({ className }: { className?: string }) {
  return (
    <p className={cn("flex flex-wrap gap-x-4 font-mono text-code-sm", className)}>
      <SkeletonLine width="w-38" />
      <SkeletonLine width="w-25" />
    </p>
  );
}

export function HeroSkeleton() {
  return (
    <div
      data-skeleton="hero"
      className="flex flex-wrap items-start justify-between gap-5 rounded-card border border-line-subtle bg-surface px-5 py-5 shadow-level-1 md:px-6.5 md:py-5.5"
    >
      <div className="flex min-w-0 items-center gap-4">
        <SkeletonBlock className="size-14 shrink-0 rounded-full" />
        <div className="min-w-0">
          <SkeletonLine className="mb-1 text-heading-xl" width="w-52" />
          <DemographicsSkeleton className="gap-y-1" />
          <p className="mt-3 flex flex-wrap gap-2">
            <TagSkeleton width="w-32" />
            <TagSkeleton width="w-24" />
          </p>
        </div>
      </div>
      <span className="inline-flex min-h-7 shrink-0 items-center rounded-pill px-3 py-1 text-label-sm">
        <SkeletonLine width="w-40" />
      </span>
    </div>
  );
}

/** Context-column panel (allergies, medications): title row plus `rows` list rows. */
export function PanelSkeleton({ rows, className }: { rows: number; className?: string }) {
  return (
    <div className={cn("rounded-card border border-line-subtle bg-surface shadow-level-1", className)}>
      <div className="px-5 pt-4 pb-3">
        <SkeletonLine className="text-label" width="w-28" />
      </div>
      <ul className="pb-1">
        {Array.from({ length: rows }, (_, i) => (
          <li key={i} className="border-t border-line-subtle px-5 py-2.75 first:border-t-0">
            <SkeletonLine className="text-label" width="w-40" />
            <SkeletonLine className="mt-0.5 text-label-sm" width="w-32" />
            <SkeletonLine className="mt-0.5 text-code-sm" width="w-20" />
          </li>
        ))}
      </ul>
    </div>
  );
}

function PrescriptionsCardSkeleton() {
  return (
    <div className="rounded-card border border-line-subtle bg-surface p-5 shadow-level-1">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="min-w-0 flex-1 basis-60">
          <p className="text-heading-sm font-semibold text-ink">Prescriptions</p>
          <p className="mt-0.5 text-label-sm text-ink-muted">
            Demo prescriptions for this patient. Signing is simulated and nothing is transmitted.
          </p>
        </div>
        <SkeletonBlock className="min-h-control-sm w-44 rounded-pill" />
      </div>
      <div className="pb-2">
        <SkeletonLine className="label-caps" width="w-24" />
      </div>
      {[0, 1].map((i) => (
        <div key={i} className="border-t border-line-subtle py-3 text-body-sm">
          <SkeletonLine width="w-48" />
          <SkeletonLine className="text-label-sm" width="w-24" />
        </div>
      ))}
    </div>
  );
}

export function ChartSkeleton() {
  return (
    <LoadingRegion label="Loading patient chart" className="flex flex-col gap-4">
      <div className="grid items-start gap-lg workspace:grid-cols-workspace">
        <div data-skeleton="main-column" className="flex min-w-0 flex-col gap-4.5">
          <HeroSkeleton />
          <PrescriptionsCardSkeleton />
        </div>
        <div data-skeleton="aside" className="flex flex-col gap-4 workspace:sticky workspace:top-below-topbar">
          <PanelSkeleton rows={2} />
          <PanelSkeleton rows={1} />
        </div>
      </div>
      <p className="max-w-footer text-label-sm text-ink-muted">
        Synthetic record. This prototype models allergies, medications and demo prescriptions only; vitals, labs,
        diagnoses, encounter notes and scheduling are not part of it.
      </p>
    </LoadingRegion>
  );
}
