import { describe, expect, it } from "vitest";
import { saveNoteSchema } from "@/features/encounter-notes/schemas";
import { setDiagnosisStatusSchema, updateDiagnosisDescriptionSchema } from "./schemas";

const ID = "d1000000-0000-4000-8000-000000000001";
const PATIENT = "00000000-0000-4000-8000-000000000101";

describe("diagnosis schemas", () => {
  it("accepts a status change with a positive version", () => {
    expect(setDiagnosisStatusSchema.safeParse({ diagnosisId: ID, status: "resolved", expectedVersion: 1 }).success).toBe(true);
    expect(setDiagnosisStatusSchema.safeParse({ diagnosisId: ID, status: "deleted", expectedVersion: 1 }).success).toBe(false);
    expect(setDiagnosisStatusSchema.safeParse({ diagnosisId: ID, status: "active", expectedVersion: 0 }).success).toBe(false);
    expect(setDiagnosisStatusSchema.safeParse({ diagnosisId: "x", status: "active", expectedVersion: 1 }).success).toBe(false);
  });

  it("trims descriptions and limits them to 1–200 characters", () => {
    const parsed = updateDiagnosisDescriptionSchema.parse({ diagnosisId: ID, description: "  Edited  ", expectedVersion: 2 });
    expect(parsed.description).toBe("Edited");
    expect(updateDiagnosisDescriptionSchema.safeParse({ diagnosisId: ID, description: "   ", expectedVersion: 2 }).success).toBe(false);
    expect(
      updateDiagnosisDescriptionSchema.safeParse({ diagnosisId: ID, description: "x".repeat(201), expectedVersion: 2 }).success,
    ).toBe(false);
  });
});

describe("saveNoteSchema", () => {
  it("creates a note only with some text", () => {
    expect(saveNoteSchema.safeParse({ patientId: PATIENT, noteId: null, expectedVersion: null, body: "Synthetic" }).success).toBe(true);
    expect(saveNoteSchema.safeParse({ patientId: PATIENT, noteId: null, expectedVersion: null, body: "  " }).success).toBe(false);
  });

  it("updates a note with its version, and allows clearing the text", () => {
    expect(saveNoteSchema.safeParse({ patientId: PATIENT, noteId: ID, expectedVersion: 3, body: "" }).success).toBe(true);
    expect(saveNoteSchema.safeParse({ patientId: PATIENT, noteId: ID, expectedVersion: null, body: "x" }).success).toBe(false);
    expect(saveNoteSchema.safeParse({ patientId: PATIENT, noteId: null, expectedVersion: 2, body: "x" }).success).toBe(false);
  });

  it("keeps the text as typed and limits it to 5000 characters", () => {
    expect(saveNoteSchema.parse({ patientId: PATIENT, noteId: ID, expectedVersion: 1, body: " a \n" }).body).toBe(" a \n");
    expect(saveNoteSchema.safeParse({ patientId: PATIENT, noteId: ID, expectedVersion: 1, body: "x".repeat(5001) }).success).toBe(false);
  });
});
