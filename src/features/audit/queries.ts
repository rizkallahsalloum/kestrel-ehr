import "server-only";
import { z } from "zod";
import { requireRole } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import type { AuditEvent } from "@/types/domain";

export const AUDIT_PAGE_SIZE = 50;

const beforeIdSchema = z.coerce.number().int().positive();

export function parseBeforeId(value: string | string[] | undefined): number | null {
  const parsed = beforeIdSchema.safeParse(Array.isArray(value) ? value[0] : value);
  return parsed.success ? parsed.data : null;
}

/** Newest first. Authorization is also enforced inside admin_list_audit_events. */
export async function listAuditEvents(beforeId: number | null): Promise<AuditEvent[]> {
  await requireRole("admin");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_list_audit_events", {
    p_limit: AUDIT_PAGE_SIZE,
    p_before_id: beforeId,
  });
  if (error) throw new Error("Could not load audit events.");
  return data;
}
