import { describe, expect, it } from "vitest";
import { patientRefFromPath } from "./last-patient";

const REF = "k7m2p9q4rx";
const NEW_REF = "V1StGXR8_Z5jdHi6B-myT";
const ID = "00000000-0000-4000-8000-000000000101";

describe("patientRefFromPath", () => {
  it.each([
    [`/patients/${REF}`, REF],
    [`/patients/${REF}/`, REF],
    [`/patients/${REF}/prescriptions/new`, REF],
    [`/patients/${NEW_REF}`, NEW_REF],
    [`/patients/${NEW_REF}/prescriptions/${REF}`, NEW_REF],
    [`/patients/${NEW_REF}x`, null],
    ["/patients", null],
    ["/patients/not-a-ref", null],
    [`/patients/${ID}`, null],
    ["/patients/K7M2P9Q4RX", null],
    ["/schedule", null],
    [`/dev/chart?id=${REF}`, null],
  ])("%s -> %s", (path, ref) => {
    expect(patientRefFromPath(path)).toBe(ref);
  });
});
