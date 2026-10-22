import type { ReactNode } from "react";
import { cn, SyntheticBanner } from "@/components/ui";
import { PatientQueue } from "@/features/patients/components/patient-queue";
import { queueItemCount, type QueuePatient } from "@/features/patients/queue";
import { PrivacyButton } from "@/features/privacy/components/privacy-controls";
import { PrivacyProvider } from "@/features/privacy/components/privacy-provider";
import { getInitials } from "@/lib/initials";
import type { AppRole } from "@/types/domain";
import { PatientSearch } from "./patient-search";
import { Rail } from "./rail";
import { SyncStatus } from "./sync-status";
import { UserMenu } from "./user-menu";

const ROLE_LABEL: Record<AppRole, string> = { clinician: "Clinician", admin: "Administrator" };

export type ShellUser = { fullName: string; role: AppRole };

/**
 * App chrome: rail, sticky top bar (search and Today's queue for clinicians; sync status, Privacy
 * button and account menu on the right) and the synthetic data banner. Presentation only; pages and data
 * functions check the user themselves. Privacy mode masks the patient values (`PrivateText`,
 * `PrivateField`) inside the content area and the queue.
 */
export function AppShell({
  user,
  signOutAction,
  searchAction,
  searchHiddenFields,
  activePath,
  queue,
  renderedAt,
  children,
}: {
  user: ShellUser;
  signOutAction?: () => Promise<void>;
  searchAction?: string;
  searchHiddenFields?: Record<string, string>;
  activePath?: string;
  /** Today's queue, clinicians only. `null` when it could not be loaded. */
  queue?: QueuePatient[] | null;
  /** Server render time (ISO), the "last synced" time. */
  renderedAt: string;
  children: ReactNode;
}) {
  const initials = getInitials(user.fullName) || "?";
  const clinician = user.role === "clinician";
  const queueItems = clinician ? queueItemCount(queue ?? null) : 0;

  return (
    <div className="grid flex-1 grid-cols-shell md:grid-cols-shell-wide">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-control focus:bg-surface-pure focus:px-3 focus:py-2 focus:text-label focus:font-semibold focus:shadow-level-2"
      >
        Skip to main content
      </a>
      <Rail role={user.role} initials={initials} activePath={activePath} fallbackPatientId={queue?.[0]?.id} />
      <PrivacyProvider>
        <div className="flex min-w-0 flex-col">
          {/* `contents`: the banner sits in the header landmark, and the top bar stays sticky against the column, not the header. */}
          <header className="contents">
            <SyntheticBanner />
            {/* Its height is --topbar-height in globals.css; data-queue-items and data-topbar-search feed it. */}
            <div
              data-topbar=""
              data-topbar-search={clinician ? "" : undefined}
              data-queue-items={queueItems || undefined}
              className={cn(
                "group/topbar sticky top-0 z-20 grid grid-areas-topbar items-center border-b border-line-subtle bg-page px-4 py-sm md:grid-areas-topbar-wide md:gap-x-5.5 md:px-7 md:py-md",
                queueItems === 1 && "queue-inline:grid-areas-topbar-inline",
              )}
            >
              {clinician && (
                <div className="area-search">
                  <PatientSearch action={searchAction} hiddenFields={searchHiddenFields} />
                </div>
              )}
              <div className="flex min-h-control-md items-center justify-end gap-2 area-controls group-data-[topbar-search]/topbar:max-md:mt-sm md:gap-4.5">
                <SyncStatus renderedAt={renderedAt} />
                <PrivacyButton />
                <UserMenu
                  fullName={user.fullName}
                  roleLabel={ROLE_LABEL[user.role]}
                  initials={initials}
                  signOutAction={signOutAction}
                />
              </div>
              {clinician && <PatientQueue queue={queue ?? null} activePath={activePath} />}
            </div>
          </header>
          <main
            id="main"
            tabIndex={-1}
            className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 focus-visible:outline-none has-[[data-layout=wide]]:max-w-none md:px-7"
          >
            {children}
          </main>
        </div>
      </PrivacyProvider>
    </div>
  );
}
