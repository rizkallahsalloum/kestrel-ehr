import type { ReactNode } from "react";
import { Avatar, SyntheticBanner, Tag } from "@/components/ui";
import { PrivacyButton } from "@/features/privacy/components/privacy-controls";
import { PrivacyProvider } from "@/features/privacy/components/privacy-provider";
import type { AppRole } from "@/types/domain";
import { PatientSearch } from "./patient-search";
import { Rail } from "./rail";
import { SignOutButton } from "./sign-out-button";

const ROLE_LABEL: Record<AppRole, string> = { clinician: "Clinician", admin: "Administrator" };

/** Initials from a display name, skipping honorifics such as "Dr.". */
export function initialsFromName(fullName: string): string {
  const words = fullName.split(/\s+/).filter((word) => word && !word.endsWith("."));
  const first = words[0]?.charAt(0) ?? "";
  const last = words.length > 1 ? (words.at(-1)?.charAt(0) ?? "") : "";
  return `${first}${last}`.toUpperCase() || "?";
}

export type ShellUser = { fullName: string; role: AppRole };

/**
 * App chrome: rail, sticky top bar (search for clinicians, Privacy mode, identity, sign-out) and the
 * synthetic data banner. Presentation only; pages and data functions check the user themselves.
 * Privacy mode masks the patient values (`PrivateText`, `PrivateField`) inside the content area.
 */
export function AppShell({
  user,
  signOutAction,
  searchAction,
  searchHiddenFields,
  activePath,
  children,
}: {
  user: ShellUser;
  signOutAction?: () => Promise<void>;
  searchAction?: string;
  searchHiddenFields?: Record<string, string>;
  activePath?: string;
  children: ReactNode;
}) {
  const initials = initialsFromName(user.fullName);

  return (
    <div className="grid flex-1 grid-cols-shell md:grid-cols-shell-wide">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-control focus:bg-surface-pure focus:px-3 focus:py-2 focus:text-label focus:font-semibold focus:shadow-level-2"
      >
        Skip to main content
      </a>
      <Rail role={user.role} initials={initials} activePath={activePath} />
      <PrivacyProvider>
        <div className="flex min-w-0 flex-col">
          {/* `contents`: the banner sits in the header landmark, and the top bar stays sticky against the column, not the header. */}
          <header className="contents">
            <SyntheticBanner />
            <div className="sticky top-0 z-20 flex flex-wrap items-center gap-3 border-b border-line-subtle bg-page px-4 py-3 md:flex-nowrap md:gap-5.5 md:px-7 md:py-4">
              {user.role === "clinician" && (
                <div className="order-1 basis-full md:order-none md:shrink-0 md:basis-75">
                  <PatientSearch action={searchAction} hiddenFields={searchHiddenFields} />
                </div>
              )}
              <div className="order-2 ml-auto flex items-center gap-2 md:order-none md:gap-4.5">
                <span className="hidden whitespace-nowrap xl:inline-flex">
                  <Tag>Synthetic data</Tag>
                </span>
                <PrivacyButton />
                <div className="flex items-center gap-3 md:border-l md:border-line-subtle md:pl-4.5">
                  <div className="text-right" data-testid="current-user">
                    <p className="text-label font-semibold whitespace-nowrap text-ink">{user.fullName}</p>
                    <p className="text-caption text-ink-muted">{ROLE_LABEL[user.role]}</p>
                  </div>
                  <Avatar initials={initials} tone="ink" size="sm" />
                </div>
                <SignOutButton action={signOutAction} />
              </div>
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
