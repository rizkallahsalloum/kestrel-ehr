"use client";

import { useActionState, useState } from "react";
import { AttestationCheck, Button, Dialog, FormField, PrivateField, TextInput } from "@/components/ui";
import {
  acknowledgeFormAction,
  cancelFormAction,
  evaluateFormAction,
  signFormAction,
  type FormState,
} from "../actions";
import type { EvaluationResult } from "../schemas";
import { ActionFeedback } from "./action-feedback";

type Ids = { patientId: string; prescriptionId: string };

function HiddenIds({ patientId, prescriptionId }: Ids) {
  return (
    <>
      <input type="hidden" name="patientId" value={patientId} />
      <input type="hidden" name="prescriptionId" value={prescriptionId} />
    </>
  );
}

/** Visible reason under a disabled control; the control points at it with `aria-describedby`. */
function DisabledReason({ id, children }: { id: string; children: string }) {
  return (
    <p id={id} className="text-label-sm text-ink-strong">
      {children}
    </p>
  );
}

export function EvaluateButton({ disabledReason, ...ids }: Ids & { disabledReason?: string }) {
  const [state, formAction, pending] = useActionState<FormState<EvaluationResult>, FormData>(evaluateFormAction, null);
  const summary =
    state?.ok &&
    `Safety check complete: ${state.data.blocking} blocking, ${state.data.advisoryTotal} advisory demo alert(s).`;
  const reasonId = `evaluate-reason-${ids.prescriptionId}`;

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <HiddenIds {...ids} />
      <Button
        type="submit"
        variant="secondary"
        size="sm"
        className="self-start"
        disabled={pending || Boolean(disabledReason)}
        aria-describedby={disabledReason ? reasonId : undefined}
      >
        {pending ? "Checking..." : "Run safety check"}
      </Button>
      {disabledReason && <DisabledReason id={reasonId}>{disabledReason}</DisabledReason>}
      <ActionFeedback state={state} success={summary || undefined} />
    </form>
  );
}

export function AlertAcknowledgeForm({ disabledReason, ...props }: Ids & { alertId: string; disabledReason?: string }) {
  const [state, formAction, pending] = useActionState<FormState<{ decisionId: string }>, FormData>(
    acknowledgeFormAction,
    null,
  );
  const [reason, setReason] = useState("");
  const fieldErrors = state && !state.ok ? state.errors.fieldErrors : {};
  const reasonId = `acknowledge-reason-${props.alertId}`;

  return (
    <form action={formAction} className="mt-2 flex flex-col gap-2">
      <HiddenIds {...props} />
      <input type="hidden" name="alertId" value={props.alertId} />
      <FormField id={`reason-${props.alertId}`} label="Acknowledgement note (optional)" errors={fieldErrors.reason}>
        <PrivateField label="Acknowledgement note">
          <TextInput name="reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} />
        </PrivateField>
      </FormField>
      <ActionFeedback state={state} visibleFields={["reason"]} />
      <Button
        type="submit"
        size="sm"
        className="self-start"
        disabled={pending || Boolean(disabledReason)}
        aria-describedby={disabledReason ? reasonId : undefined}
      >
        {pending ? "Saving..." : "Acknowledge advisory alert"}
      </Button>
      {disabledReason && <DisabledReason id={reasonId}>{disabledReason}</DisabledReason>}
    </form>
  );
}

const ATTESTATION_REASON = "Tick the attestation above to confirm your review.";

/**
 * Attestation plus the sign button. The label names the first thing still missing; the full list
 * of reasons sits under the button and describes it.
 */
export function SignConfirmation({
  expectedVersion,
  canSign,
  reasons,
  label,
  ...ids
}: Ids & {
  expectedVersion: number;
  canSign: boolean;
  /** Why signing is blocked, apart from the attestation (added here from local state). */
  reasons: string[];
  label: (attested: boolean) => string;
}) {
  const [state, formAction, pending] = useActionState<FormState<{ prescriptionId: string }>, FormData>(
    signFormAction,
    null,
  );
  const [attested, setAttested] = useState(false);
  const blockedBy = attested ? reasons : [...reasons, ATTESTATION_REASON];
  const reasonsId = `sign-reasons-${ids.prescriptionId}`;

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <HiddenIds {...ids} />
      <input type="hidden" name="expectedVersion" value={expectedVersion} />
      <AttestationCheck
        name="attestation"
        checked={attested}
        onChange={(e) => setAttested(e.target.checked)}
        label="I reviewed this draft, the patient's allergies and current medications, and every demo alert. I understand this is a simulated signature on synthetic data."
      />
      <ActionFeedback state={state} />
      <Button
        type="submit"
        size="cta"
        data-testid="sign-button"
        disabled={pending || !canSign || !attested}
        aria-describedby={
          blockedBy.length > 0 ? blockedBy.map((_, index) => `${reasonsId}-${index}`).join(" ") : undefined
        }
      >
        {pending ? "Signing..." : label(attested)}
      </Button>
      {blockedBy.length > 0 && (
        // The items are referenced one by one: a referenced list's aria-label would replace its text in the description.
        <ul aria-label="Signing prerequisites" className="list-disc pl-5 text-label-sm text-ink-strong">
          {blockedBy.map((reason, index) => (
            <li key={reason} id={`${reasonsId}-${index}`}>
              {reason}
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}

export function CancelDraftDialog(props: Ids & { expectedVersion: number }) {
  const [state, formAction, pending] = useActionState<FormState<{ prescriptionId: string }>, FormData>(
    cancelFormAction,
    null,
  );
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        Cancel this draft
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Cancel this draft?"
        description="The draft stays in the record as cancelled and can no longer be edited or signed."
      >
        <form action={formAction} className="flex flex-col gap-3">
          <HiddenIds {...props} />
          <input type="hidden" name="expectedVersion" value={props.expectedVersion} />
          <FormField id="cancel-reason" label="Reason (optional)">
            <PrivateField label="Cancel reason">
              <TextInput name="reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} />
            </PrivateField>
          </FormField>
          <ActionFeedback state={state} />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Keep draft
            </Button>
            <Button type="submit" variant="danger" disabled={pending}>
              {pending ? "Cancelling..." : "Cancel draft"}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
