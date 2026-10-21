import type { ReactNode } from "react";
import { KestrelMark } from "@/components/shell/kestrel-mark";
import { SyntheticBanner } from "@/components/ui";

/** Centred sign-in card with the rail-coloured brand strip (plan section 8; no HTML reference). */
export function LoginCard({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col">
      <header>
        <SyntheticBanner />
      </header>
      <main className="flex flex-1 items-center justify-center p-4 md:p-6">
        <div className="w-full max-w-sm overflow-hidden rounded-card border border-line-subtle bg-surface shadow-level-1">
          <div className="flex items-center gap-3 bg-inverse px-6 py-4 text-on-inverse">
            <KestrelMark className="size-7" />
            <h1 className="font-display text-heading-lg font-medium tracking-tight">Kestrel EHR</h1>
          </div>
          <div className="flex flex-col gap-5 p-6">
            <p className="text-body-sm text-ink-secondary">Sign in with a synthetic demo account.</p>
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
