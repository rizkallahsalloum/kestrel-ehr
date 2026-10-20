import { cn } from "@/components/ui";

/** Kestrel wordmark glyph from the dashboard reference. Decorative; label the surrounding link. */
export function KestrelMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 34 34" fill="none" aria-hidden="true" focusable="false" className={cn("size-8.5", className)}>
      <path d="M17 3 L27 15 L20 15 L27 31 L17 22 L7 31 L14 15 L7 15 Z" fill="currentColor" opacity="0.95" />
    </svg>
  );
}
