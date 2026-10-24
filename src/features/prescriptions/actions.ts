"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  DB_ERROR,
  fail,
  isDbError,
  mapDbError,
  ok,
  validationFailure,
  type ActionResult,
} from "@/lib/actions/result";
import { prescriptionPath } from "@/features/patients/refs";
import { authorizeAction } from "@/lib/auth/guards";
import { createClient, type ServerSupabaseClient } from "@/lib/supabase/server";
import {
  acknowledgeAlertSchema,
  cancelSchema,
  createDraftSchema,
  evaluateSchema,
  evaluationResultSchema,
  signSchema,
  toPrescriptionColumns,
  updateDraftSchema,
  type EvaluationResult,
} from "./schemas";

// Every exported function here is a public endpoint. Each one authenticates,
// checks the role, validates with the shared schema, and then relies on RLS
// and the database functions for record-level authorization.

export type FormState<T> = ActionResult<T> | null;

function formToObject(formData: FormData): Record<string, FormDataEntryValue> {
  return Object.fromEntries(formData.entries());
}

/**
 * Refreshes every page under the root layout: the chart and prescription pages (addressed by
 * opaque refs, so by route pattern) and Today's queue in the (app) layout, whose status dots
 * come from draft alerts.
 */
function revalidatePrescription(): void {
  revalidatePath("/", "layout");
}

async function prescriptionBelongsToPatient(
  supabase: ServerSupabaseClient,
  prescriptionId: string,
  patientId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("prescriptions")
    .select("id")
    .eq("id", prescriptionId)
    .eq("patient_id", patientId)
    .maybeSingle();
  return Boolean(data);
}

type CreatedDraft = { prescriptionId: string; prescriptionRef: string; patientRef: string; duplicate: boolean };

export async function createPrescriptionDraft(input: unknown): Promise<ActionResult<CreatedDraft>> {
  const auth = await authorizeAction("clinician");
  if (!auth.ok) return auth.result;

  const parsed = createDraftSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  const { patientId, idempotencyKey, ...content } = parsed.data;

  const supabase = await createClient();
  const patient = await supabase.from("patients").select("id, public_ref").eq("id", patientId).maybeSingle();
  if (patient.error) return mapDbError(patient.error);
  if (!patient.data) return fail("NOT_FOUND", "Patient not found.");

  const inserted = await supabase
    .from("prescriptions")
    .insert({
      patient_id: patientId,
      prescriber_id: auth.user.id,
      idempotency_key: idempotencyKey,
      ...toPrescriptionColumns(content),
    })
    .select("id, public_ref")
    .single();
  const patientRef = patient.data.public_ref;

  if (inserted.error) {
    if (isDbError(inserted.error, "23505")) {
      // Same form submitted twice: return the draft created by the first submission.
      const existing = await supabase
        .from("prescriptions")
        .select("id, public_ref, patient_id")
        .eq("prescriber_id", auth.user.id)
        .eq("idempotency_key", idempotencyKey)
        .maybeSingle();
      if (existing.data?.patient_id === patientId) {
        return ok({ prescriptionId: existing.data.id, prescriptionRef: existing.data.public_ref, patientRef, duplicate: true });
      }
    }
    return mapDbError(inserted.error);
  }

  revalidatePrescription();
  return ok({ prescriptionId: inserted.data.id, prescriptionRef: inserted.data.public_ref, patientRef, duplicate: false });
}

export async function updatePrescriptionDraft(input: unknown): Promise<ActionResult<{ version: number }>> {
  const auth = await authorizeAction("clinician");
  if (!auth.ok) return auth.result;

  const parsed = updateDraftSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  const { patientId, prescriptionId, expectedVersion, ...content } = parsed.data;

  const supabase = await createClient();
  const updated = await supabase
    .from("prescriptions")
    .update(toPrescriptionColumns(content))
    .eq("id", prescriptionId)
    .eq("patient_id", patientId)
    .eq("version", expectedVersion)
    .select("id, version")
    .maybeSingle();
  if (updated.error) return mapDbError(updated.error);

  if (!updated.data) {
    // Nothing matched: work out why without revealing records the user cannot see.
    const current = await supabase
      .from("prescriptions")
      .select("status, version, prescriber_id")
      .eq("id", prescriptionId)
      .eq("patient_id", patientId)
      .maybeSingle();
    if (!current.data) return fail("NOT_FOUND", "Prescription not found.");
    if (current.data.prescriber_id !== auth.user.id) {
      return fail("FORBIDDEN", "Only the prescriber can edit this draft.");
    }
    if (current.data.status !== "draft") return mapDbError({ code: DB_ERROR.NOT_A_DRAFT });
    return mapDbError({ code: DB_ERROR.VERSION_CONFLICT });
  }

  revalidatePrescription();
  return ok({ version: updated.data.version });
}

export async function evaluatePrescription(input: unknown): Promise<ActionResult<EvaluationResult>> {
  const auth = await authorizeAction("clinician");
  if (!auth.ok) return auth.result;

  const parsed = evaluateSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  const { patientId, prescriptionId } = parsed.data;

  const supabase = await createClient();
  if (!(await prescriptionBelongsToPatient(supabase, prescriptionId, patientId))) {
    return fail("NOT_FOUND", "Prescription not found.");
  }

  const { data, error } = await supabase.rpc("evaluate_prescription_safety", { p_prescription_id: prescriptionId });
  if (error) return mapDbError(error);
  const result = evaluationResultSchema.safeParse(data);
  if (!result.success) return fail("INTERNAL", "Unexpected response from the safety check.");

  revalidatePrescription();
  return ok(result.data);
}

export async function acknowledgeAlert(input: unknown): Promise<ActionResult<{ decisionId: string }>> {
  const auth = await authorizeAction("clinician");
  if (!auth.ok) return auth.result;

  const parsed = acknowledgeAlertSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  const { patientId, prescriptionId, alertId, reason } = parsed.data;

  const supabase = await createClient();
  if (!(await prescriptionBelongsToPatient(supabase, prescriptionId, patientId))) {
    return fail("NOT_FOUND", "Prescription not found.");
  }

  const { data, error } = await supabase.rpc("acknowledge_prescription_alert", {
    p_alert_id: alertId,
    p_reason: reason ?? null,
  });
  if (error) return mapDbError(error);

  revalidatePrescription();
  return ok({ decisionId: data });
}

export async function signPrescription(input: unknown): Promise<ActionResult<{ prescriptionId: string }>> {
  const auth = await authorizeAction("clinician");
  if (!auth.ok) return auth.result;

  const parsed = signSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  const { patientId, prescriptionId, expectedVersion } = parsed.data;

  const supabase = await createClient();
  if (!(await prescriptionBelongsToPatient(supabase, prescriptionId, patientId))) {
    return fail("NOT_FOUND", "Prescription not found.");
  }

  const { error } = await supabase.rpc("sign_prescription", {
    p_prescription_id: prescriptionId,
    p_expected_version: expectedVersion,
  });
  if (error) {
    if (isDbError(error, DB_ERROR.BLOCKING_ALERT) || isDbError(error, DB_ERROR.UNACKNOWLEDGED_ADVISORY)) {
      // The failed sign rolled back its own evaluation; persist the current alerts so the user can see them.
      await supabase.rpc("evaluate_prescription_safety", { p_prescription_id: prescriptionId });
      revalidatePrescription();
    }
    return mapDbError(error);
  }

  revalidatePrescription();
  return ok({ prescriptionId });
}

export async function cancelPrescription(input: unknown): Promise<ActionResult<{ prescriptionId: string }>> {
  const auth = await authorizeAction("clinician");
  if (!auth.ok) return auth.result;

  const parsed = cancelSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  const { patientId, prescriptionId, expectedVersion, reason } = parsed.data;

  const supabase = await createClient();
  if (!(await prescriptionBelongsToPatient(supabase, prescriptionId, patientId))) {
    return fail("NOT_FOUND", "Prescription not found.");
  }

  const { error } = await supabase.rpc("cancel_prescription", {
    p_prescription_id: prescriptionId,
    p_expected_version: expectedVersion,
    p_reason: reason ?? null,
  });
  if (error) return mapDbError(error);

  revalidatePrescription();
  return ok({ prescriptionId });
}

// Form adapters for useActionState.

/** Result codes for successful actions; the client maps each to fixed text (`outcome-text.ts`). */
export type PrescriptionOutcome = "draft-saved" | "alert-acknowledged" | "prescription-signed" | "draft-cancelled";
export type WithOutcome<T> = T & { outcome: PrescriptionOutcome };

function withOutcome<T>(result: ActionResult<T>, outcome: PrescriptionOutcome): ActionResult<WithOutcome<T>> {
  return result.ok ? ok({ ...result.data, outcome }) : result;
}

export async function createDraftFormAction(
  _previous: FormState<CreatedDraft>,
  formData: FormData,
): Promise<FormState<CreatedDraft>> {
  const result = await createPrescriptionDraft(formToObject(formData));
  if (result.ok) redirect(prescriptionPath(result.data.patientRef, result.data.prescriptionRef));
  return result;
}

export async function updateDraftFormAction(
  _previous: FormState<WithOutcome<{ version: number }>>,
  formData: FormData,
): Promise<FormState<WithOutcome<{ version: number }>>> {
  return withOutcome(await updatePrescriptionDraft(formToObject(formData)), "draft-saved");
}

export async function evaluateFormAction(
  _previous: FormState<EvaluationResult>,
  formData: FormData,
): Promise<FormState<EvaluationResult>> {
  return evaluatePrescription(formToObject(formData));
}

export async function acknowledgeFormAction(
  _previous: FormState<WithOutcome<{ decisionId: string }>>,
  formData: FormData,
): Promise<FormState<WithOutcome<{ decisionId: string }>>> {
  return withOutcome(await acknowledgeAlert(formToObject(formData)), "alert-acknowledged");
}

export async function signFormAction(
  _previous: FormState<WithOutcome<{ prescriptionId: string }>>,
  formData: FormData,
): Promise<FormState<WithOutcome<{ prescriptionId: string }>>> {
  return withOutcome(await signPrescription(formToObject(formData)), "prescription-signed");
}

export async function cancelFormAction(
  _previous: FormState<WithOutcome<{ prescriptionId: string }>>,
  formData: FormData,
): Promise<FormState<WithOutcome<{ prescriptionId: string }>>> {
  return withOutcome(await cancelPrescription(formToObject(formData)), "draft-cancelled");
}
