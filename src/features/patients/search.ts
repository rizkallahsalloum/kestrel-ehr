import { z } from "zod";
import type { PatientSummary } from "@/types/domain";

export const PATIENT_QUERY_MAX = 100;

/** Normalises the `q` search param: first value only, whitespace collapsed, length capped. */
export const patientQuerySchema = z
  .string()
  .transform((value) => value.replace(/\s+/g, " ").trim().slice(0, PATIENT_QUERY_MAX));

export function parsePatientQuery(raw: string | string[] | undefined): string {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const parsed = patientQuerySchema.safeParse(value ?? "");
  return parsed.success ? parsed.data : "";
}

function normalise(value: string): string {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

/**
 * Filters an already RLS-scoped patient list by name or MRN. Every search term must match the
 * given name, family name or MRN. Runs on the server; the query never reaches the database.
 */
export function filterPatients<T extends Pick<PatientSummary, "given_name" | "family_name" | "mrn">>(
  patients: T[],
  query: string,
): T[] {
  const terms = normalise(query).split(" ").filter(Boolean);
  if (terms.length === 0) return patients;
  return patients.filter((patient) => {
    const fields = [patient.given_name, patient.family_name, patient.mrn].map(normalise);
    return terms.every((term) => fields.some((field) => field.includes(term)));
  });
}
