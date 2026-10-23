import "server-only";
import { notFound, permanentRedirect } from "next/navigation";
import { requireRole } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { isLegacyId, isPublicRef, patientPath, prescriptionPath } from "./refs";

export type ResolvedPatient = { patientId: string; patientRef: string };
export type ResolvedPrescription = ResolvedPatient & { prescriptionId: string; prescriptionRef: string };

/**
 * Turns the patient segment of a URL into the internal id, under RLS. A reference
 * resolves for care-team members; an old id-based link is permanently redirected to
 * the reference URL (keeping `subpath`). Anything else, or a patient the caller
 * cannot see, is a 404, so unknown and forbidden look the same.
 */
export async function resolvePatientSegment(segment: string, subpath = ""): Promise<ResolvedPatient> {
  await requireRole("clinician");
  const supabase = await createClient();

  if (isPublicRef(segment)) {
    const { data, error } = await supabase.from("patients").select("id").eq("public_ref", segment).maybeSingle();
    if (error) throw new Error("Could not open the patient.");
    if (!data) notFound();
    return { patientId: data.id, patientRef: segment };
  }

  if (isLegacyId(segment)) {
    const { data, error } = await supabase.from("patients").select("public_ref").eq("id", segment).maybeSingle();
    if (error) throw new Error("Could not open the patient.");
    if (!data) notFound();
    permanentRedirect(`${patientPath(data.public_ref)}${subpath}`);
  }

  notFound();
}

/** Same as `resolvePatientSegment`, for a prescription under that patient. */
export async function resolvePrescriptionSegments(
  patientSegment: string,
  prescriptionSegment: string,
): Promise<ResolvedPrescription> {
  const patient = await resolvePatientSegment(patientSegment, `/prescriptions/${prescriptionSegment}`);
  const supabase = await createClient();

  if (isPublicRef(prescriptionSegment)) {
    const { data, error } = await supabase
      .from("prescriptions")
      .select("id")
      .eq("public_ref", prescriptionSegment)
      .eq("patient_id", patient.patientId)
      .maybeSingle();
    if (error) throw new Error("Could not open the prescription.");
    if (!data) notFound();
    return { ...patient, prescriptionId: data.id, prescriptionRef: prescriptionSegment };
  }

  if (isLegacyId(prescriptionSegment)) {
    const { data, error } = await supabase
      .from("prescriptions")
      .select("public_ref")
      .eq("id", prescriptionSegment)
      .eq("patient_id", patient.patientId)
      .maybeSingle();
    if (error) throw new Error("Could not open the prescription.");
    if (!data) notFound();
    permanentRedirect(prescriptionPath(patient.patientRef, data.public_ref));
  }

  notFound();
}
