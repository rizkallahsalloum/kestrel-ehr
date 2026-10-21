import type { ReactNode } from "react";
import { cn } from "./cn";

const bar = "block rounded-control bg-line-subtle motion-safe:animate-pulse";

/** Decorative placeholder box. Size it with the same classes as the element it stands in for. */
export function SkeletonBlock({ className }: { className?: string }) {
  return <span aria-hidden="true" className={cn(bar, className)} />;
}

/**
 * One line of text in a given text style. Pass the text class (for example `text-heading-xl`) so the
 * box is exactly one line tall; the bar sits in the middle of the line like the glyphs would.
 */
export function SkeletonLine({ className, width = "w-full" }: { className?: string; width?: string }) {
  return (
    <span aria-hidden="true" className={cn("flex h-lh items-center", className)}>
      <span className={cn(bar, "h-3/5", width)} />
    </span>
  );
}

/**
 * Wraps a page skeleton: one polite status for screen readers; the skeleton itself is hidden from
 * them, so it may repeat static text but must not contain links or other focusable elements.
 * `wide` marks the page as full width, like the prescribing views.
 */
export function LoadingRegion({
  label,
  wide = false,
  className,
  children,
}: {
  label: string;
  wide?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div role="status" aria-busy="true" data-skeleton="page">
      <span className="sr-only">{label}</span>
      <div aria-hidden="true" data-layout={wide ? "wide" : undefined} className={className}>
        {children}
      </div>
    </div>
  );
}
