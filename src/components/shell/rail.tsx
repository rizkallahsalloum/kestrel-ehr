"use client"; // Active item and the Chart and E-Rx targets depend on the URL and this tab's last-viewed chart.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";
import { AuditIcon, Avatar, BillingIcon, CalendarIcon, ChartIcon, cn, FlaskIcon, RxIcon } from "@/components/ui";
import type { AppRole } from "@/types/domain";
import { KestrelMark } from "./kestrel-mark";
import { lastPatientStore, patientIdFromPath } from "./last-patient";

type NavItem = { key: string; href: string; label: string; Icon: typeof ChartIcon; active: boolean };

function clinicianItems(current: string, patientId: string | null): NavItem[] {
  const onPrescriptions = /^\/patients\/[^/]+\/prescriptions(?:\/|$)/.test(current);
  return [
    {
      key: "chart",
      href: patientId ? `/patients/${patientId}` : "/patients",
      label: "Chart",
      Icon: ChartIcon,
      active: current === "/patients" || (current.startsWith("/patients/") && !onPrescriptions),
    },
    { key: "schedule", href: "/schedule", label: "Schedule", Icon: CalendarIcon, active: current === "/schedule" },
    {
      key: "erx",
      href: patientId ? `/patients/${patientId}/prescriptions/new` : "/patients",
      label: "E-Rx",
      Icon: RxIcon,
      active: onPrescriptions,
    },
    { key: "labs", href: "/labs", label: "Labs", Icon: FlaskIcon, active: current === "/labs" },
    { key: "billing", href: "/billing", label: "Billing", Icon: BillingIcon, active: current === "/billing" },
  ];
}

function adminItems(current: string): NavItem[] {
  return [
    {
      key: "audit",
      href: "/admin/audit",
      label: "Audit",
      Icon: AuditIcon,
      active: current === "/admin/audit" || current.startsWith("/admin/audit/"),
    },
  ];
}

// The theme focus colour is 2.7:1 on the inverse rail; rail controls use a white outline instead.
const railFocus = "focus-visible:outline-on-inverse";

/**
 * Dark navigation rail: 76px with labels, 60px icon-only at 760px and below. Chart and E-Rx open the
 * current patient, else the last chart viewed in this tab, else the first patient in Today's queue.
 */
export function Rail({
  role,
  initials,
  activePath,
  fallbackPatientId,
}: {
  role: AppRole;
  initials: string;
  activePath?: string;
  fallbackPatientId?: string;
}) {
  const pathname = usePathname();
  const current = activePath ?? pathname;
  const pathPatient = patientIdFromPath(current);
  const lastPatient = useSyncExternalStore(lastPatientStore.subscribe, lastPatientStore.get, () => null);

  useEffect(() => {
    if (pathPatient) lastPatientStore.set(pathPatient);
  }, [pathPatient]);

  const items =
    role === "clinician" ? clinicianItems(current, pathPatient ?? lastPatient ?? fallbackPatientId ?? null) : adminItems(current);

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
        {items.map(({ key, href, label, Icon, active }) => (
          <Link
            key={key}
            href={href}
            aria-current={active ? (href === current ? "page" : "true") : undefined}
            data-rail-item={key}
            className={cn(
              "flex h-13 w-11 flex-col items-center justify-center gap-1 rounded-control px-1 text-caption transition-colors md:w-17",
              railFocus,
              active
                ? "bg-on-inverse/10 text-on-inverse shadow-rail-current"
                : "text-on-inverse-muted hover:bg-on-inverse/6 hover:text-on-inverse",
            )}
          >
            <Icon className="size-4.5 md:size-4.75" />
            <span className="sr-only whitespace-nowrap md:not-sr-only">{label}</span>
          </Link>
        ))}
      </nav>
      <div className="flex w-full justify-center border-t border-on-inverse/10 pt-3.5">
        <Avatar initials={initials} tone="teal" size="sm" />
      </div>
    </aside>
  );
}
