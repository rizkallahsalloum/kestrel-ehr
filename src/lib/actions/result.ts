import { z } from "zod";

export type ActionErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION"
  | "CONFLICT"
  | "RULE_VIOLATION"
  | "INTERNAL";

export type ActionErrors = {
  code: ActionErrorCode;
  formErrors: string[];
  fieldErrors: Record<string, string[]>;
};

export type ActionSuccess<T> = { ok: true; data: T };
export type ActionFailure = { ok: false; errors: ActionErrors };
export type ActionResult<T> = ActionSuccess<T> | ActionFailure;

export function ok<T>(data: T): ActionSuccess<T> {
  return { ok: true, data };
}

export function fail(
  code: ActionErrorCode,
  message?: string,
  fieldErrors: Record<string, string[]> = {},
): ActionFailure {
  return { ok: false, errors: { code, formErrors: message ? [message] : [], fieldErrors } };
}

export function validationFailure(error: z.ZodError): ActionFailure {
  const flattened = z.flattenError(error);
  const fieldErrors: Record<string, string[]> = {};
  for (const [key, messages] of Object.entries(flattened.fieldErrors)) {
    if (Array.isArray(messages) && messages.length > 0) fieldErrors[key] = messages;
  }
  return {
    ok: false,
    errors: { code: "VALIDATION", formErrors: flattened.formErrors, fieldErrors },
  };
}

/** Application error codes raised by Kestrel database functions and triggers. */
export const DB_ERROR = {
  NOT_A_DRAFT: "KE001",
  VERSION_CONFLICT: "KE002",
  BLOCKING_ALERT: "KE003",
  UNACKNOWLEDGED_ADVISORY: "KE004",
  START_DATE_WINDOW: "KE005",
  INACTIVE_MEDICATION: "KE006",
  ALERT_NOT_ACTIONABLE: "KE007",
} as const;

export type PostgrestLikeError = { code?: string | null; message?: string | null };

const DB_ERROR_MAP: Record<string, { code: ActionErrorCode; message: string; field?: string }> = {
  [DB_ERROR.NOT_A_DRAFT]: { code: "CONFLICT", message: "This prescription is no longer a draft." },
  [DB_ERROR.VERSION_CONFLICT]: {
    code: "CONFLICT",
    message: "This draft changed since you opened it. Reload and review it again.",
  },
  [DB_ERROR.BLOCKING_ALERT]: {
    code: "RULE_VIOLATION",
    message: "A blocking demo alert is active. Change the medication or cancel the draft.",
  },
  [DB_ERROR.UNACKNOWLEDGED_ADVISORY]: {
    code: "RULE_VIOLATION",
    message: "Acknowledge every advisory demo alert before signing.",
  },
  [DB_ERROR.START_DATE_WINDOW]: {
    code: "VALIDATION",
    message: "Start date must be within 30 days of today.",
    field: "startDate",
  },
  [DB_ERROR.INACTIVE_MEDICATION]: {
    code: "VALIDATION",
    message: "Choose an active medication from the catalog.",
    field: "medicationId",
  },
  [DB_ERROR.ALERT_NOT_ACTIONABLE]: {
    code: "CONFLICT",
    message: "This alert can no longer be acknowledged. Re-run the safety check.",
  },
  "42501": { code: "FORBIDDEN", message: "You are not allowed to perform this action." },
  P0002: { code: "NOT_FOUND", message: "The requested record was not found." },
  PGRST116: { code: "NOT_FOUND", message: "The requested record was not found." },
  "23505": { code: "CONFLICT", message: "This record already exists." },
  "23514": { code: "VALIDATION", message: "One or more values are outside the permitted range." },
  "23503": { code: "VALIDATION", message: "A referenced record does not exist." },
  "22P02": { code: "VALIDATION", message: "One or more values have an invalid format." },
};

/**
 * Maps a Supabase/PostgREST error to a typed failure. Raw database messages are
 * never returned to the client because they can contain row data.
 */
export function mapDbError(error: PostgrestLikeError): ActionFailure {
  const mapped = error.code ? DB_ERROR_MAP[error.code] : undefined;
  if (!mapped) {
    console.error("Unmapped database error", { code: error.code ?? null });
    return fail("INTERNAL", "Something went wrong. Please try again.");
  }
  return fail(mapped.code, mapped.message, mapped.field ? { [mapped.field]: [mapped.message] } : {});
}

export function isDbError(error: PostgrestLikeError | null | undefined, code: string): boolean {
  return error?.code === code;
}
