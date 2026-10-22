import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AppShell, type ShellUser } from "@/components/shell/app-shell";
import { AuditLogView } from "@/features/audit/components/audit-log-view";
import { AuditSkeleton } from "@/features/audit/components/audit-skeleton";
import type { AuditEvent } from "@/types/domain";
import { Delayed, delayParam } from "../delayed";

export const metadata: Metadata = { title: "Audit specimen (development only) | Kestrel EHR" };

// Static, obviously fake audit rows for reviewing the audit table. No data access.

const ADMIN: ShellUser = { fullName: "Demo Administrator", role: "admin" };
const CLINICIAN_ID = "a0000000-0000-4000-8000-00000000000a";
const PATIENT_ID = "00000000-0000-4000-8000-000000000101";
const RX_ID = "00000000-0000-4000-8000-000000000201";

function event(id: number, minute: number, overrides: Partial<AuditEvent>): AuditEvent {
  return {
    id,
    occurred_at: `2026-10-19T09:${String(minute).padStart(2, "0")}:00Z`,
    actor_id: CLINICIAN_ID,
    actor_role: "clinician",
    action: "prescription.updated",
    entity_type: "prescription",
    entity_id: RX_ID,
    patient_id: PATIENT_ID,
    metadata: { specimen: true },
    ...overrides,
  };
}

const EVENTS: AuditEvent[] = [
  event(9007, 40, { action: "prescription.signed", metadata: { specimen: true, version: 3 } }),
  event(9006, 35, { action: "alert.acknowledged", entity_type: "prescription_alert", entity_id: "00000000-0000-4000-8000-000000000301" }),
  event(9005, 30, { action: "prescription.evaluated", metadata: { specimen: true, blocking: 0, advisory: 1 } }),
  event(9004, 20, { action: "prescription.created", metadata: { specimen: true, version: 1 } }),
  event(9003, 10, { action: "patient_chart.viewed", entity_type: "patient", entity_id: PATIENT_ID, metadata: {} }),
  event(9002, 5, { action: "prescription.cancelled", entity_id: "00000000-0000-4000-8000-000000000202", metadata: { specimen: true, reason_given: true } }),
  event(9001, 0, {
    action: "care_team.member_added",
    actor_id: null,
    actor_role: null,
    entity_type: "care_team",
    entity_id: "c0000000-0000-4000-8000-000000000001",
    patient_id: null,
    metadata: { specimen: true, role: "clinician" },
  }),
];

export default async function AuditSpecimenPage({ searchParams }: PageProps<"/dev/audit">) {
  if (process.env.NODE_ENV !== "development") notFound();

  const params = await searchParams;
  const delay = delayParam(params.delay);
  const empty = params.view === "empty";

  const content = (
    <>
      <AuditLogView events={empty ? [] : EVENTS} newerHref={null} olderHref={empty ? null : "/dev/audit?view=empty"} />
      <p className="mt-6 text-label-sm text-ink-muted">
        Development specimen with synthetic, obviously fake rows. Views:{" "}
        <Link href="/dev/audit" className="underline">
          events
        </Link>
        {" · "}
        <Link href="/dev/audit?view=empty" className="underline">
          empty
        </Link>
        {" · "}
        <Link href="/dev/audit?skeleton=1" className="underline">
          skeleton
        </Link>
      </p>
    </>
  );

  return (
    <AppShell user={ADMIN} activePath="/admin/audit" renderedAt={new Date().toISOString()}>
      {params.skeleton ? (
        <AuditSkeleton />
      ) : delay ? (
        <Suspense fallback={<AuditSkeleton />}>
          <Delayed ms={delay}>{content}</Delayed>
        </Suspense>
      ) : (
        content
      )}
    </AppShell>
  );
}
