import { CheckCircleIcon, PrivateText } from "@/components/ui";
import { medicationLabel } from "@/features/chart/alerts";
import { AllergyPanel, MedicationPanel } from "@/features/chart/components/clinical-lists";
import { formatDateTime } from "@/lib/format";
import type { Allergy, MedicationOption, PatientMedication, PatientSummary } from "@/types/domain";
import { newDraftValues, savedDraftValues } from "../form-values";
import type { PrescriptionWorkspace } from "../queries";
import { labelLines } from "../sig";
import { isEditable } from "../transitions";
import { safetyState, type SafetyState } from "../workspace";
import { DraftWorkspace } from "./draft-workspace";
import { ErxGrid, ErxPageHeading, ReviewShell, reviewCount, RxPatientHeader, RxSafetySummary } from "./erx-layout";
import { LabelPreviewButton } from "./label-preview";
import { PrescriptionSummary, SafetyDecisionList } from "./prescription-summary";

function Context({
  safety,
  allergies,
  patientMedications,
}: {
  safety: SafetyState;
  allergies: Allergy[];
  patientMedications: PatientMedication[];
}) {
  return (
    <>
      <RxSafetySummary state={safety} />
      <AllergyPanel allergies={allergies} />
      <MedicationPanel medications={patientMedications} />
    </>
  );
}

function patientName(patient: PatientSummary): string {
  return `${patient.family_name}, ${patient.given_name}`;
}

export function NewPrescriptionView({
  patient,
  medications,
  allergies,
  patientMedications,
  idempotencyKey,
  startDate,
}: {
  patient: PatientSummary;
  medications: MedicationOption[];
  allergies: Allergy[];
  patientMedications: PatientMedication[];
  idempotencyKey: string;
  startDate: string;
}) {
  return (
    <div data-layout="wide" className="flex flex-col gap-4">
      <ErxPageHeading patientId={patient.id} title="New prescription" />
      <RxPatientHeader patient={patient} allergies={allergies} medications={patientMedications} />
      <DraftWorkspace
        mode="create"
        idempotencyKey={idempotencyKey}
        patientId={patient.id}
        patientName={patientName(patient)}
        medications={medications}
        initialValues={newDraftValues(startDate)}
        context={<Context safety={{ kind: "unsaved" }} allergies={allergies} patientMedications={patientMedications} />}
      />
    </div>
  );
}

export function PrescriptionView({ workspace }: { workspace: PrescriptionWorkspace }) {
  const { patient, prescription: rx, alerts, isOwnPrescription } = workspace;
  const safety = safetyState(rx, alerts);
  const context = (
    <Context safety={safety} allergies={workspace.allergies} patientMedications={workspace.patientMedications} />
  );
  const editable = isOwnPrescription && isEditable(rx.status);

  return (
    <div data-layout="wide" className="flex flex-col gap-4">
      <ErxPageHeading
        patientId={patient.id}
        title={<PrivateText label="Medication">{medicationLabel(rx)}</PrivateText>}
        status={rx.status}
      />
      <RxPatientHeader patient={patient} allergies={workspace.allergies} medications={workspace.patientMedications} />
      {editable ? (
        <DraftWorkspace
          key={rx.version}
          mode="edit"
          saved={{ prescription: rx, alerts, prescriberName: workspace.prescriberName }}
          patientId={patient.id}
          patientName={patientName(patient)}
          medications={workspace.medications}
          initialValues={savedDraftValues(rx)}
          context={context}
        />
      ) : (
        <ErxGrid context={context} main={<ReadOnlyMain workspace={workspace} />} review={<ReadOnlyReview workspace={workspace} />} />
      )}
    </div>
  );
}

function ReadOnlyMain({ workspace }: { workspace: PrescriptionWorkspace }) {
  const { prescription: rx, alerts } = workspace;
  return (
    <>
      <section aria-labelledby="rx-details-title" className="rounded-card border border-line-subtle bg-surface px-5 py-4">
        <h2 id="rx-details-title" className="mb-3 text-heading-sm font-semibold text-ink">
          Prescription details
        </h2>
        <PrescriptionSummary prescription={rx} prescriberName={workspace.prescriberName} />
      </section>
      {alerts.length > 0 && (
        <section aria-labelledby="rx-alerts-title" className="rounded-card border border-line-subtle bg-surface px-5 py-4">
          <h2 id="rx-alerts-title" className="mb-3 text-heading-sm font-semibold text-ink">
            Demo alerts for this version
          </h2>
          <SafetyDecisionList alerts={alerts} />
        </section>
      )}
    </>
  );
}

function ReadOnlyReview({ workspace }: { workspace: PrescriptionWorkspace }) {
  const { patient, prescription: rx } = workspace;
  const label = (
    <LabelPreviewButton
      className="self-start"
      lines={labelLines({
        patientName: patientName(patient),
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
  );

  if (rx.status === "signed") {
    return (
      <ReviewShell title="Signed (simulated)" subtitle={`Version ${rx.version}`} count={{ tone: "ok", text: "Signed" }}>
        <div className="flex flex-col items-center gap-1 py-2 text-center">
          <CheckCircleIcon className="size-6 text-ok" />
          <p className="text-heading-sm font-semibold text-ok">Signed (simulated). Not transmitted anywhere.</p>
          {rx.signed_at && (
            <p className="text-label-sm text-ink-strong">
              {formatDateTime(rx.signed_at)} by {workspace.prescriberName ?? "the prescriber"}. Recorded in the audit log.
            </p>
          )}
        </div>
        {label}
      </ReviewShell>
    );
  }

  if (rx.status === "cancelled") {
    return (
      <ReviewShell title="Cancelled" subtitle={`Version ${rx.version}`} count={{ tone: "neutral", text: "Read only" }}>
        <p role="status" className="text-body-sm text-ink-strong">
          This draft was cancelled. It stays in the record and can no longer be edited or signed.
        </p>
      </ReviewShell>
    );
  }

  return (
    <ReviewShell title="Draft (read only)" subtitle={`Saved version ${rx.version}`} count={reviewCount(safetyState(rx, workspace.alerts))}>
      <p className="text-body-sm text-ink-strong">Only the prescriber can edit, sign or cancel this draft.</p>
      {label}
    </ReviewShell>
  );
}
