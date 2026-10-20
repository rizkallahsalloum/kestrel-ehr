"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AuditIcon, Avatar, ChartIcon, cn } from "@/components/ui";
import type { AppRole } from "@/types/domain";
import { KestrelMark } from "./kestrel-mark";

const NAV_ITEMS: Record<AppRole, { href: string; label: string; Icon: typeof ChartIcon }[]> = {
  clinician: [{ href: "/patients", label: "Patients", Icon: ChartIcon }],
  admin: [{ href: "/admin/audit", label: "Audit", Icon: AuditIcon }],
};

// The theme focus colour is 2.7:1 on the inverse rail; rail controls use a white outline instead.
const railFocus = "focus-visible:outline-on-inverse";

/** Dark navigation rail: 76px with labels, 60px icon-only at 760px and below. */
export function Rail({ role, initials, activePath }: { role: AppRole; initials: string; activePath?: string }) {
  const pathname = usePathname();
  const current = activePath ?? pathname;

  return (
    <aside className="sticky top-0 flex h-dvh flex-col items-center bg-inverse pt-4.5 pb-4 text-on-inverse">
      <Link
        href="/"
        aria-label="Kestrel EHR home"
        className={cn("mb-6.5 grid size-8.5 place-items-center rounded-control", railFocus)}
      >
        <KestrelMark />
      </Link>
      <nav aria-label="Main" className="flex w-full flex-1 flex-col items-center gap-1.5">
        {NAV_ITEMS[role].map(({ href, label, Icon }) => {
          const active = current === href || current.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex h-13 w-11 flex-col items-center justify-center gap-1 rounded-control text-caption transition-colors md:w-13",
                railFocus,
                active
                  ? "bg-on-inverse/10 text-on-inverse shadow-rail-current"
                  : "text-on-inverse-muted hover:bg-on-inverse/6 hover:text-on-inverse",
              )}
            >
              <Icon className="size-4.5 md:size-4.75" />
              <span className="sr-only md:not-sr-only">{label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="flex w-full justify-center border-t border-on-inverse/10 pt-3.5">
        <Avatar initials={initials} tone="teal" size="sm" />
      </div>
    </aside>
  );
}
