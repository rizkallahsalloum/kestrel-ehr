import type { FormState, PrescriptionOutcome, WithOutcome } from "./actions";

/** Toast text per result code: fixed strings with no patient, medication or dose details. */
export const OUTCOME_TOAST: Record<PrescriptionOutcome, string> = {
  "draft-saved": "Draft saved.",
  "alert-acknowledged": "Advisory alert acknowledged.",
  "prescription-signed": "Prescription signed (simulated).",
  "draft-cancelled": "Draft cancelled.",
};

type FormAction<T> = (previous: FormState<WithOutcome<T>>, formData: FormData) => Promise<FormState<WithOutcome<T>>>;

/** Wraps a form action so a successful result shows its toast; failures stay inline. */
export function withOutcomeToast<T>(action: FormAction<T>, notify: (message: string) => void): FormAction<T> {
  return async (previous, formData) => {
    const result = await action(previous, formData);
    if (result?.ok && result.data.outcome) notify(OUTCOME_TOAST[result.data.outcome]);
    return result;
  };
}
