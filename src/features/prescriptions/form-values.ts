import type { Prescription } from "@/types/domain";

/** Form state as strings, exactly as the inputs hold it. The shared Zod schema parses it on submit. */
export type PrescriptionFormValues = {
  medicationId: string;
  doseAmount: string;
  doseUnit: string;
  route: string;
  frequency: string;
  quantity: string;
  refills: string;
  durationDays: string;
  startDate: string;
  instructions: string;
};

export function newDraftValues(startDate: string): PrescriptionFormValues {
  return {
    medicationId: "",
    doseAmount: "",
    doseUnit: "mg",
    route: "oral",
    frequency: "once_daily",
    quantity: "",
    refills: "0",
    durationDays: "",
    startDate,
    instructions: "",
  };
}

/** Renew: a signed prescription's content as a new draft, starting on `startDate`. */
export function renewalDraftValues(rx: Prescription, startDate: string): PrescriptionFormValues {
  return { ...savedDraftValues(rx), startDate };
}

export function savedDraftValues(rx: Prescription): PrescriptionFormValues {
  return {
    medicationId: rx.medication_id,
    doseAmount: String(rx.dose_amount),
    doseUnit: rx.dose_unit,
    route: rx.route,
    frequency: rx.frequency,
    quantity: String(rx.quantity),
    refills: String(rx.refills),
    durationDays: rx.duration_days ? String(rx.duration_days) : "",
    startDate: rx.start_date,
    instructions: rx.instructions ?? "",
  };
}
