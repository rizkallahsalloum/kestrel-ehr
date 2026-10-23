import { z } from "zod";

/**
 * Opaque URL references for patients and prescriptions. A reference is random
 * (assigned by the database, see migrations 0011 and 0016), carries no meaning and is
 * never derived from the internal id, a name or an MRN. New references have 21
 * URL-safe characters; references issued before 0016 have 10 and stay valid.
 * Must match the `*_public_ref_format` checks in the database.
 */
export const PUBLIC_REF_LENGTH = 21;
export const LEGACY_PUBLIC_REF_LENGTH = 10;
export const PUBLIC_REF_MAX_LENGTH = 32;
export const PUBLIC_REF_PATTERN = /^(?:[0-9a-hjkmnp-tv-z]{10}|[A-Za-z0-9_-]{21})$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const publicRefSchema = z.string().max(PUBLIC_REF_MAX_LENGTH).regex(PUBLIC_REF_PATTERN);

export function isPublicRef(value: string): boolean {
  return publicRefSchema.safeParse(value).success;
}

/** Old links used the internal id; those are redirected to the reference URL. */
export function isLegacyId(value: string): boolean {
  return UUID_PATTERN.test(value);
}

export function patientPath(patientRef: string): string {
  return `/patients/${patientRef}`;
}

export function newPrescriptionPath(patientRef: string): string {
  return `/patients/${patientRef}/prescriptions/new`;
}

/** New draft prefilled from a signed prescription (Renew). */
export function renewPrescriptionPath(patientRef: string, prescriptionRef: string): string {
  return `${newPrescriptionPath(patientRef)}?renew=${prescriptionRef}`;
}

export function prescriptionPath(patientRef: string, prescriptionRef: string): string {
  return `/patients/${patientRef}/prescriptions/${prescriptionRef}`;
}
