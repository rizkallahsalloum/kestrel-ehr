import { z } from "zod";

/** Same limit as the `diagnoses.description` check constraint. */
export const DIAGNOSIS_DESCRIPTION_MAX = 200;

const version = z.coerce.number().int().min(1);

export const setDiagnosisStatusSchema = z.object({
  diagnosisId: z.uuid(),
  status: z.enum(["active", "resolved"]),
  expectedVersion: version,
});

export const updateDiagnosisDescriptionSchema = z.object({
  diagnosisId: z.uuid(),
  description: z
    .string()
    .trim()
    .min(1, "Enter a description.")
    .max(DIAGNOSIS_DESCRIPTION_MAX, `Use ${DIAGNOSIS_DESCRIPTION_MAX} characters or fewer.`),
  expectedVersion: version,
});

export type SetDiagnosisStatusInput = z.infer<typeof setDiagnosisStatusSchema>;
export type UpdateDiagnosisDescriptionInput = z.infer<typeof updateDiagnosisDescriptionSchema>;
