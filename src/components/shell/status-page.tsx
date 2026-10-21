import type { ReactNode } from "react";
import { NoAlert, SyntheticBanner } from "@/components/ui";

/** Centred card for not-found and error states (plan section 8). */
export function StatusPage({
  title,
  icon,
  message,
  actions,
}: {
  title: string;
  icon: ReactNode;
  message: ReactNode;
  actions: ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col">
      <header>
        <SyntheticBanner />
      </header>
      <main className="flex flex-1 items-center justify-center p-4 md:p-8">
        <div className="flex w-full max-w-md flex-col gap-4 rounded-card border border-line-subtle bg-surface p-6">
          <h1 className="font-display text-heading-lg font-medium tracking-tight">{title}</h1>
          <NoAlert icon={icon}>{message}</NoAlert>
          <div className="flex flex-wrap gap-2.5">{actions}</div>
        </div>
      </main>
    </div>
  );
}
