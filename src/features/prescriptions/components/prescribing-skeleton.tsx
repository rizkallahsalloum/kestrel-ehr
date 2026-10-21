import { LoadingRegion, SkeletonBlock, SkeletonLine } from "@/components/ui";
import { DemographicsSkeleton, PanelSkeleton } from "@/features/chart/components/chart-skeleton";
import { ErxGrid } from "./erx-layout";

// Mirrors the prescribing views: the same ErxGrid, header and card boxes, so the columns stay put
// (three above 1280px, two above 820px, one below) when the real workspace replaces it.

function TileSkeleton() {
  return (
    <div className="max-w-75 min-w-0 flex-1 basis-55 rounded-panel border border-line-subtle bg-surface-warm px-3.5 py-2.5">
      <SkeletonLine className="text-label" width="w-28" />
      <SkeletonLine className="mt-0.5 text-label" width="w-40" />
    </div>
  );
}

function PatientHeaderSkeleton() {
  return (
    <div
      data-skeleton="rx-header"
      className="grid items-center gap-x-6 gap-y-4 rounded-card border border-line-subtle bg-surface px-5.5 py-4.5 erx-wide:grid-cols-rx-header"
    >
      <div className="flex min-w-0 items-center gap-4">
        <SkeletonBlock className="size-13 shrink-0 rounded-full" />
        <div className="min-w-0">
          <SkeletonLine className="text-heading-md" width="w-44" />
          <DemographicsSkeleton className="mt-0.5 mb-1.5" />
          <p className="flex flex-wrap gap-1.5">
            {["w-32", "w-24"].map((width) => (
              <span
                key={width}
                className="inline-flex rounded-pill border border-line-subtle bg-surface-warm px-2.5 py-0.5 text-label-sm"
              >
                <SkeletonLine width={width} />
              </span>
            ))}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-3 erx-wide:justify-end">
        <TileSkeleton />
        <TileSkeleton />
      </div>
    </div>
  );
}

function SafetySummarySkeleton() {
  return (
    <div className="rounded-card border border-line-subtle bg-surface px-5 py-4">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <p className="text-heading-sm font-semibold text-ink">Medication safety</p>
        <span className="text-label-sm text-ink-muted">Saved version</span>
      </div>
      <div className="rounded-panel border border-line bg-surface-warm px-4 py-3 text-label">
        <SkeletonLine width="w-36" />
        <SkeletonLine width="w-48 max-w-full" />
      </div>
    </div>
  );
}

function TrackerSkeleton() {
  return (
    <div className="@container rounded-card border border-line-subtle bg-surface px-3.5 py-2.5">
      <ol className="flex flex-col gap-2 @tracker-row:flex-row @tracker-row:gap-1">
        {["w-20", "w-24", "w-16"].map((width) => (
          <li key={width} className="@tracker-row:flex-auto">
            <span className="flex min-h-9 items-center gap-2 px-2 text-label">
              <SkeletonBlock className="size-5.5 shrink-0 rounded-full" />
              <SkeletonLine width={width} />
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function SectionSkeleton({ title, fields }: { title: string; fields: number }) {
  return (
    <div className="rounded-card border border-line-subtle bg-surface px-5 py-4">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <p className="text-heading-sm font-semibold text-ink">{title}</p>
      </div>
      <div className="flex flex-col gap-3">
        {Array.from({ length: fields }, (_, i) => (
          <div key={i}>
            <SkeletonLine className="text-label" width="w-24" />
            <SkeletonBlock className="mt-1 min-h-control-md w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

function ReviewSkeleton() {
  return (
    <div className="overflow-hidden rounded-card border border-line-subtle bg-surface shadow-level-1">
      <div className="bg-inverse px-5 py-4">
        <p className="text-heading-sm font-semibold text-on-inverse">Review prescription</p>
        <SkeletonLine className="text-label-sm" width="w-28" />
      </div>
      <div className="flex flex-col gap-4 px-5 py-4">
        <SkeletonLine className="text-body-sm" />
        <SkeletonLine className="text-body-sm" width="w-3/4" />
        <SkeletonBlock className="min-h-cta w-full rounded-pill" />
      </div>
    </div>
  );
}

export function PrescribingSkeleton({ withStatus = false }: { withStatus?: boolean }) {
  return (
    <LoadingRegion label="Loading prescription workspace" wide className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <SkeletonLine className="text-label" width="w-24" />
          <SkeletonLine className="mt-1 text-heading-xl" width="w-56" />
        </div>
        {withStatus && (
          <span className="inline-flex rounded-pill px-2.5 py-0.5 text-caption">
            <SkeletonLine width="w-10" />
          </span>
        )}
      </div>
      <PatientHeaderSkeleton />
      <ErxGrid
        context={
          <div data-skeleton="context" className="flex flex-col gap-4">
            <SafetySummarySkeleton />
            <PanelSkeleton rows={2} />
            <PanelSkeleton rows={1} />
          </div>
        }
        main={
          <div data-skeleton="form" className="flex flex-col gap-4">
            <TrackerSkeleton />
            <SectionSkeleton title="Medication" fields={1} />
            <SectionSkeleton title="Directions and supply" fields={3} />
            <SectionSkeleton title="Instructions" fields={1} />
          </div>
        }
        review={
          <div data-skeleton="review">
            <ReviewSkeleton />
          </div>
        }
      />
    </LoadingRegion>
  );
}
