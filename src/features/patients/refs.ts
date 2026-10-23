/**
 * Opaque URL references for patients and prescriptions. A reference is random
 * (assigned by the database, see migration 0011), carries no meaning and is
 * never derived from the internal id, a name or an MRN.
 */
export const PUBLIC_REF_PATTERN = /^[0-9a-hjkmnp-tv-z]{10}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isPublicRef(value: string): boolean {
  return PUBLIC_REF_PATTERN.test(value);
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

export function prescriptionPath(patientRef: string, prescriptionRef: string): string {
  return `/patients/${patientRef}/prescriptions/${prescriptionRef}`;
}
