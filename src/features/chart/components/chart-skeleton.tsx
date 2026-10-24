import { cn, LoadingRegion, SkeletonBlock, SkeletonLine } from "@/components/ui";
import { DiagnosisTableSkeleton } from "@/features/diagnoses/components/diagnosis-table";
import { EncounterNotesSkeleton } from "@/features/encounter-notes/components/encounter-notes-panel";
import { Hba1cChartSkeleton } from "@/features/labs/components/hba1c-chart";
import { VitalsBandSkeleton } from "@/features/vitals/components/vitals-band";

// The chart page renders the real hero, alert slot and allergy panel first (ChartLayout), so these
// stand in only for what streams after them: same card boxes and line heights as ChartMain and the
// medication panel. Rows stand in for typical content.

/** Age and DOB, then MRN: two unbreakable runs that wrap onto separate lines on narrow screens. */
export function DemographicsSkeleton({ className }: { className?: string }) {
  return (
    <p className={cn("flex flex-wrap gap-x-4 font-mono text-code-sm", className)}>
      <SkeletonLine width="w-38" />
      <SkeletonLine width="w-25" />
    </p>
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

/** Fallback for `ChartLayout`'s `main`: everything below the alert slot. The one loading status. */
export function ChartMainSkeleton() {
  return (
    <LoadingRegion label="Loading patient chart" className="flex flex-col gap-4.5">
      <VitalsBandSkeleton />
      <Hba1cChartSkeleton />
      <DiagnosisTableSkeleton />
      <PrescriptionsCardSkeleton />
      <EncounterNotesSkeleton />
    </LoadingRegion>
  );
}

/** Fallback for `ChartLayout`'s `medications`, under the real allergy panel. */
export function MedicationPanelSkeleton() {
  return (
    <div aria-hidden="true" data-skeleton="medications">
      <PanelSkeleton rows={1} />
    </div>
  );
}

/**
 * Route `loading.tsx`: shown only until the hero and the alert slot are ready, then the page itself
 * draws them with `ChartMainSkeleton` below. Nothing visible, so nothing jumps when it is replaced.
 */
export function ChartRouteLoading() {
  return <LoadingRegion label="Loading patient chart">{null}</LoadingRegion>;
}
