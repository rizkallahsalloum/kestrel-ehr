import type { ReactNode } from "react";
import { SyntheticBanner } from "@/components/ui";
import { PatientQueue } from "@/features/patients/components/patient-queue";
import type { QueuePatient } from "@/features/patients/queue";
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
 * App chrome: rail, sticky top bar (search, Privacy pill, Today's queue and sync status for
 * clinicians, account menu) and the synthetic data banner. Presentation only; pages and data
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
  const queueProps = { queue: queue ?? null, activePath };

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
            <div className="sticky top-0 z-20 flex flex-wrap items-center gap-3 border-b border-line-subtle bg-page px-4 py-3 md:flex-nowrap md:gap-5.5 md:px-7 md:py-4">
              {clinician && (
                <div className="order-1 basis-full md:order-none md:shrink-0 md:basis-75">
                  <PatientSearch action={searchAction} hiddenFields={searchHiddenFields} />
                </div>
              )}
              <div className="order-2 ml-auto flex min-w-0 items-center gap-2 md:order-none md:ml-0 md:flex-1 md:gap-4.5">
                <PrivacyButton />
                {clinician && <PatientQueue layout="bar" {...queueProps} />}
                <div className="ml-auto flex shrink-0 items-center gap-4.5">
                  <SyncStatus renderedAt={renderedAt} />
                  <UserMenu
                    fullName={user.fullName}
                    roleLabel={ROLE_LABEL[user.role]}
                    initials={initials}
                    signOutAction={signOutAction}
                  />
                </div>
              </div>
            </div>
            {clinician && <PatientQueue layout="row" {...queueProps} />}
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
