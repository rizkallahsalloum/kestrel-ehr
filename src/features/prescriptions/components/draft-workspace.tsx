"use client";

import { useActionState, useState, type ReactNode } from "react";
import { AlertTriangleIcon, Button, NoAlert } from "@/components/ui";
import { medicationLabel } from "@/features/chart/alerts";
import type { MedicationOption, Prescription, PrescriptionAlert } from "@/types/domain";
import { createDraftFormAction, updateDraftFormAction, type FormState } from "../actions";
import type { PrescriptionFormValues } from "../form-values";
import { labelLines } from "../sig";
import { getSignReadiness } from "../transitions";
import { countAlerts, isDirty, safetyState, signButtonLabel, trackerSteps } from "../workspace";
import { ActionFeedback } from "./action-feedback";
import { DirectionsSection, InstructionsSection, MedicationSection, SectionTracker } from "./draft-sections";
import { ErxGrid, ReviewShell, reviewCount } from "./erx-layout";
import { LabelPreviewButton } from "./label-preview";
import { PrescriptionSummary, SafetyDecisionList } from "./prescription-summary";
import { AlertAcknowledgeForm, CancelDraftDialog, EvaluateButton, SignConfirmation } from "./workflow-controls";

const FORM_ID = "prescription-draft-form";
const FIELDS = [
  "medicationId",
  "doseAmount",
  "doseUnit",
  "route",
  "frequency",
  "quantity",
  "refills",
  "durationDays",
  "startDate",
  "instructions",
];

export type SavedDraft = { prescription: Prescription; alerts: PrescriptionAlert[]; prescriberName: string | null };

type Props = {
  /** Server-rendered left column (safety summary, allergies, medications). */
  context: ReactNode;
  patientId: string;
  patientName: string;
  medications: MedicationOption[];
  initialValues: PrescriptionFormValues;
} & ({ mode: "create"; idempotencyKey: string } | { mode: "edit"; saved: SavedDraft });

/**
 * Editable draft: the form in the middle column and the review panel on the right. The review
 * panel always shows the saved version, which is what the safety check and signing use (C-A4).
 * Key this component by the saved version so a save resets the unsaved-changes state.
 */
export function DraftWorkspace(props: Props) {
  const [values, setValues] = useState(props.initialValues);
  const action = props.mode === "create" ? createDraftFormAction : updateDraftFormAction;
  const [state, formAction, pending] = useActionState<FormState<unknown>, FormData>(
    action as (state: FormState<unknown>, formData: FormData) => Promise<FormState<unknown>>,
    null,
  );
  const fieldErrors = state && !state.ok ? state.errors.fieldErrors : {};
  const saved = props.mode === "edit" ? props.saved : null;
  const dirty = saved ? isDirty(values, props.initialValues) : false;

  const bind = (name: keyof PrescriptionFormValues) => ({
    name,
    value: values[name],
    onChange: (event: { target: { value: string } }) => setValues((v) => ({ ...v, [name]: event.target.value })),
  });

  const steps = trackerSteps(
    values,
    props.medications.map((m) => m.id),
    Boolean(saved) && !dirty,
  );

  const main = (
    <div className="flex flex-col gap-4 @container">
      <SectionTracker steps={steps} />
      <form id={FORM_ID} action={formAction} noValidate className="flex flex-col gap-4">
        <input type="hidden" name="patientId" value={props.patientId} />
        {props.mode === "create" ? (
          <input type="hidden" name="idempotencyKey" value={props.idempotencyKey} />
        ) : (
          <>
            <input type="hidden" name="prescriptionId" value={props.saved.prescription.id} />
            <input type="hidden" name="expectedVersion" value={props.saved.prescription.version} />
          </>
        )}
        <ActionFeedback state={state} success="Draft saved. Run the safety check again." visibleFields={FIELDS} />
        <MedicationSection
          medications={props.medications}
          value={values.medicationId}
          onChange={(medicationId) => setValues((v) => ({ ...v, medicationId }))}
          errors={fieldErrors.medicationId}
        />
        <DirectionsSection values={values} bind={bind} errors={fieldErrors} />
        <InstructionsSection bind={bind} errors={fieldErrors} />
      </form>
    </div>
  );

  const review = saved ? (
    <SavedReview saved={saved} patientId={props.patientId} patientName={props.patientName} dirty={dirty} pending={pending} />
  ) : (
    <ReviewShell title="Review prescription" subtitle="Nothing saved yet" count={reviewCount({ kind: "unsaved" })}>
      <p className="text-body-sm text-ink-strong">
        Create the draft to see its saved details here and run the demo safety check. Signing is simulated.
      </p>
      <Button type="submit" form={FORM_ID} size="cta" disabled={pending}>
        {pending ? "Saving..." : "Create draft"}
      </Button>
      <p className="text-center text-label-sm text-ink-muted">Nothing is transmitted to a pharmacy.</p>
    </ReviewShell>
  );

  return <ErxGrid context={props.context} main={main} review={review} />;
}

function SavedReview({
  saved,
  patientId,
  patientName,
  dirty,
  pending,
}: {
  saved: SavedDraft;
  patientId: string;
  patientName: string;
  dirty: boolean;
  pending: boolean;
}) {
  const { prescription: rx, alerts } = saved;
  const ids = { patientId, prescriptionId: rx.id };
  const safety = safetyState(rx, alerts);
  const counts = countAlerts(alerts);
  const evaluated = safety.kind === "checked";
  const readiness = getSignReadiness({
    status: rx.status,
    version: rx.version,
    lastEvaluatedVersion: rx.last_evaluated_version,
    alerts: alerts.map((a) => ({ severity: a.severity, acknowledged: Boolean(a.decision) })),
  });
  const reasons = dirty ? ["Save your changes: signing uses the saved version.", ...readiness.reasons] : readiness.reasons;

  return (
    <ReviewShell title="Review prescription" subtitle={`Saved version ${rx.version}`} count={reviewCount(safety)}>
      <div aria-live="polite">
        {dirty && (
          <p className="flex items-start gap-2 rounded-panel border border-warning-line bg-warning-subtle px-3.5 py-2.5 text-label font-semibold text-warning">
            <AlertTriangleIcon className="mt-0.5" />
            Unsaved changes. Save the draft to re-run the safety check.
          </p>
        )}
      </div>

      <PrescriptionSummary prescription={rx} prescriberName={saved.prescriberName} />

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-label font-semibold text-ink">Safety decisions</h3>
          {evaluated && (
            <span className="text-label-sm text-ink-muted">
              {counts.blocking + counts.advisoryPending} open, {counts.acknowledged} acknowledged
            </span>
          )}
        </div>
        <p className="text-label-sm text-ink-secondary">
          Illustrative synthetic rules only, not clinical decision support.
        </p>
        <EvaluateButton
          {...ids}
          disabledReason={dirty ? "Save your changes first: the safety check runs on the saved version." : undefined}
        />
        {!evaluated ? (
          <NoAlert icon={<AlertTriangleIcon className="text-ink-muted" />}>The saved version has not been checked yet.</NoAlert>
        ) : alerts.length === 0 ? (
          <NoAlert>No demo alerts for this version.</NoAlert>
        ) : (
          <SafetyDecisionList
            alerts={alerts}
            medicationHref="#rx-medication"
            renderAcknowledge={(alert) => (
              <AlertAcknowledgeForm
                {...ids}
                alertId={alert.id}
                disabledReason={
                  dirty ? "Save your changes first: acknowledgements belong to the saved version." : undefined
                }
              />
            )}
          />
        )}
      </div>

      <SignConfirmation
        {...ids}
        expectedVersion={rx.version}
        canSign={readiness.canSign && !dirty}
        reasons={reasons}
        label={(attested) => signButtonLabel({ readiness, counts, evaluated, dirty, attested })}
      />

      <div className="grid grid-cols-2 gap-2">
        <Button type="submit" form={FORM_ID} variant="secondary" disabled={pending || !dirty}>
          {pending ? "Saving..." : "Save draft"}
        </Button>
        <LabelPreviewButton
          lines={labelLines({
            patientName,
            medication: medicationLabel(rx),
            doseAmount: rx.dose_amount,
            doseUnit: rx.dose_unit,
            route: rx.route,
            frequency: rx.frequency,
            quantity: rx.quantity,
            refills: rx.refills,
            instructions: rx.instructions,
          })}
        />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-label-sm text-ink-muted">Signing is simulated. Nothing is transmitted.</p>
        <CancelDraftDialog {...ids} expectedVersion={rx.version} />
      </div>
    </ReviewShell>
  );
}
