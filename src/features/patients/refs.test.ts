import { describe, expect, it } from "vitest";
import {
  isLegacyId,
  isPublicRef,
  LEGACY_PUBLIC_REF_LENGTH,
  patientPath,
  prescriptionPath,
  PUBLIC_REF_LENGTH,
  PUBLIC_REF_MAX_LENGTH,
  publicRefSchema,
  renewPrescriptionPath,
} from "./refs";

const LEGACY = "8nstgphb8h";
const NEW = "V1StGXR8_Z5jdHi6B-myT";

describe("public references", () => {
  it("new references are 21 characters and legacy ones 10, both under the 32 limit", () => {
    expect(NEW).toHaveLength(PUBLIC_REF_LENGTH);
    expect(LEGACY).toHaveLength(LEGACY_PUBLIC_REF_LENGTH);
    expect(PUBLIC_REF_LENGTH).toBeLessThanOrEqual(PUBLIC_REF_MAX_LENGTH);
  });

  it.each([LEGACY, "syn0000101", "0123456789", NEW, "AAAAAAAAAAAAAAAAAAAAA", "_-_-_-_-_-_-_-_-_-_-_"])("accepts %s", (ref) => {
    expect(isPublicRef(ref)).toBe(true);
    expect(publicRefSchema.safeParse(ref).success).toBe(true);
  });

  it.each([
    ["empty", ""],
    ["legacy with an excluded letter", "8nstgphb8i"],
    ["legacy in upper case", "8NSTGPHB8H"],
    ["legacy with a dash", "8nstg-hb8h"],
    ["9 characters", "8nstgphb8"],
    ["11 characters", "8nstgphb8hx"],
    ["20 characters", NEW.slice(0, 20)],
    ["22 characters", `${NEW}x`],
    ["33 characters", "A".repeat(33)],
    ["a dot", "V1StGXR8.Z5jdHi6B-myT"],
    ["a slash", "V1StGXR8/Z5jdHi6B-myT"],
    ["a percent sign", "V1StGXR8%Z5jdHi6B-myT"],
    ["an internal id", "00000000-0000-4000-8000-000000000101"],
  ])("rejects %s", (_name, ref) => {
    expect(isPublicRef(ref)).toBe(false);
  });

  it("never confuses a reference with an old id-based link", () => {
    expect(isLegacyId(LEGACY)).toBe(false);
    expect(isLegacyId(NEW)).toBe(false);
    expect(isLegacyId("00000000-0000-4000-8000-000000000101")).toBe(true);
  });

  it("puts both shapes into URLs unchanged, without encoding", () => {
    expect(patientPath(NEW)).toBe(`/patients/${NEW}`);
    expect(patientPath(LEGACY)).toBe(`/patients/${LEGACY}`);
    expect(prescriptionPath(LEGACY, NEW)).toBe(`/patients/${LEGACY}/prescriptions/${NEW}`);
    expect(renewPrescriptionPath(NEW, LEGACY)).toBe(`/patients/${NEW}/prescriptions/new?renew=${LEGACY}`);
    expect(encodeURIComponent(NEW)).toBe(NEW);
  });
});
