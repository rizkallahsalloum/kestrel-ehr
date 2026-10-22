import { describe, expect, it } from "vitest";
import { patientIdFromPath } from "./last-patient";

const ID = "00000000-0000-4000-8000-000000000101";

describe("patientIdFromPath", () => {
  it.each([
    [`/patients/${ID}`, ID],
    [`/patients/${ID}/`, ID],
    [`/patients/${ID}/prescriptions/new`, ID],
    ["/patients", null],
    ["/patients/not-an-id", null],
    ["/schedule", null],
    [`/dev/chart?id=${ID}`, null],
  ])("%s -> %s", (path, id) => {
    expect(patientIdFromPath(path)).toBe(id);
  });
});
