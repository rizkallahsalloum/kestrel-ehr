import type { Enums, Tables } from "./database";

export type AppRole = Enums<"app_role">;
export type PrescriptionStatus = Enums<"prescription_status">;
export type AlertSeverity = Enums<"alert_severity">;
export type AllergySeverity = Enums<"allergy_severity">;
export type DoseUnit = Enums<"dose_unit">;
export type MedicationRoute = Enums<"medication_route">;
export type DoseFrequency = Enums<"dose_frequency">;

export type PatientSummary = Pick<
  Tables<"patients">,
  "id" | "public_ref" | "mrn" | "given_name" | "family_name" | "date_of_birth" | "sex"
> & { care_team: { name: string } | null };

export type MedicationOption = Pick<Tables<"medications">, "id" | "name" | "strength" | "form" | "drug_class_code">;

export type Allergy = Pick<
  Tables<"allergies">,
  "id" | "substance_text" | "reaction" | "severity" | "drug_class_code" | "status"
>;

export type PatientMedication = Pick<
  Tables<"patient_medications">,
  "id" | "dose_text" | "start_date" | "status" | "source_prescription_id"
> & { medication: Pick<Tables<"medications">, "name" | "strength" | "form"> | null };

export type PrescriptionListItem = Pick<
  Tables<"prescriptions">,
  | "id"
  | "public_ref"
  | "status"
  | "version"
  | "last_evaluated_version"
  | "quantity"
  | "start_date"
  | "created_at"
  | "signed_at"
  | "prescriber_id"
> & { medication: Pick<Tables<"medications">, "name" | "strength" | "form"> | null };

/** Unresolved alert on a draft, as read for the chart's alert slot. */
export type DraftAlertRow = Pick<
  Tables<"prescription_alerts">,
  "id" | "prescription_id" | "prescription_version" | "severity" | "message"
> & { decision: { id: string } | null };

export type Prescription = Tables<"prescriptions"> & {
  medication: MedicationOption | null;
};

export type PrescriptionAlert = Pick<
  Tables<"prescription_alerts">,
  "id" | "severity" | "message" | "prescription_version" | "resolved_at" | "allergy_id" | "patient_medication_id"
> & { decision: Pick<Tables<"prescription_safety_decisions">, "id" | "reason" | "created_at"> | null };

export type AuditEvent = {
  id: number;
  occurred_at: string;
  actor_id: string | null;
  actor_role: AppRole | null;
  action: string;
  entity_type: string;
  entity_id: string;
  patient_id: string | null;
  metadata: unknown;
};
