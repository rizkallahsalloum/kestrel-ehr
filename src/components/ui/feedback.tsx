import type { ReactNode } from "react";
import { InfoIcon } from "./icons";

export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="text-body-sm text-ink-muted">{children}</p>;
}

/** Required by the project rules on every app page. */
export function SyntheticBanner() {
  return (
    <p
      role="note"
      className="flex items-center justify-center gap-2 border-b border-warning-line bg-warning-subtle px-4 py-1.5 text-center text-label-sm font-medium text-warning"
    >
      <InfoIcon className="size-3.5" />
      Synthetic data prototype. Not for clinical use. Safety alerts are illustrative demo rules only.
    </p>
  );
}
