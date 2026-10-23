"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, mapDbError, ok, validationFailure, type ActionResult } from "@/lib/actions/result";
import { authorizeAction } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { setDiagnosisStatusSchema, updateDiagnosisDescriptionSchema } from "./schemas";

// Public endpoints: each one authenticates, checks the role and validates; the
// database functions check the care team and the version, and write the
// revision and the audit row in the same transaction (a failed audit write
// fails the change).

export type DiagnosisChange = { id: string; status: "active" | "resolved"; version: number };

const changeSchema = z.object({
  id: z.uuid(),
  status: z.enum(["active", "resolved"]),
  version: z.number().int().min(1),
});

function parseChange(data: unknown): ActionResult<DiagnosisChange> {
  const parsed = changeSchema.safeParse(data);
  if (!parsed.success) return fail("INTERNAL", "Something went wrong. Please try again.");
  revalidatePath("/", "layout");
  return ok(parsed.data);
}

export async function setDiagnosisStatus(input: unknown): Promise<ActionResult<DiagnosisChange>> {
  const auth = await authorizeAction("clinician");
  if (!auth.ok) return auth.result;

  const parsed = setDiagnosisStatusSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("set_diagnosis_status", {
    p_diagnosis_id: parsed.data.diagnosisId,
    p_status: parsed.data.status,
    p_expected_version: parsed.data.expectedVersion,
  });
  if (error) return mapDbError(error);
  return parseChange(data);
}

export async function updateDiagnosisDescription(input: unknown): Promise<ActionResult<DiagnosisChange>> {
  const auth = await authorizeAction("clinician");
  if (!auth.ok) return auth.result;

  const parsed = updateDiagnosisDescriptionSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("update_diagnosis_description", {
    p_diagnosis_id: parsed.data.diagnosisId,
    p_description: parsed.data.description,
    p_expected_version: parsed.data.expectedVersion,
  });
  if (error) return mapDbError(error);
  return parseChange(data);
}
