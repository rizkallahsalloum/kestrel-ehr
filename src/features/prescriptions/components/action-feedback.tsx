import { CheckCircleIcon, FormErrors } from "@/components/ui";
import type { ActionResult } from "@/lib/actions/result";

/** Shows form-level errors, plus field errors that have no visible input of their own. */
export function ActionFeedback<T>({
  state,
  success,
  visibleFields = [],
}: {
  state: ActionResult<T> | null;
  success?: string;
  visibleFields?: string[];
}) {
  if (!state) return null;
  if (state.ok) {
    return success ? (
      <p role="status" className="flex items-center gap-1.5 text-body-sm font-medium text-ok">
        <CheckCircleIcon />
        {success}
      </p>
    ) : null;
  }
  const hidden = Object.entries(state.errors.fieldErrors)
    .filter(([field]) => !visibleFields.includes(field))
    .flatMap(([, messages]) => messages);
  return <FormErrors messages={[...state.errors.formErrors, ...hidden]} />;
}
