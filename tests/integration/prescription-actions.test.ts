import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MEDICATIONS, PATIENTS, type IdentityKey } from "../../scripts/fixtures.ts";
import { anonClient, clientFor, type TypedClient } from "../helpers/supabase";

// Server Actions run with whichever Supabase client the test selects, so the
// real RLS policies and database functions decide every outcome.
let current: TypedClient;
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => current }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

const actions = await import("@/features/prescriptions/actions");

async function as(key: IdentityKey | "anon") {
  current = key === "anon" ? anonClient() : await clientFor(key);
}

const today = new Date().toISOString().slice(0, 10);

function draftInput(patientId: string, medicationId: string, idempotencyKey = randomUUID()) {
  return {
    patientId,
    idempotencyKey,
    medicationId,
    doseAmount: "10",
    doseUnit: "mg",
    route: "oral",
    frequency: "once_daily",
    quantity: "30",
    refills: "0",
    durationDays: "",
    startDate: today,
    instructions: "",
  };
}

async function createDraft(patientId: string, medicationId: string): Promise<string> {
  const result = await actions.createPrescriptionDraft(draftInput(patientId, medicationId));
  if (!result.ok) throw new Error(`Draft creation failed: ${result.errors.code}`);
  return result.data.prescriptionId;
}

beforeEach(async () => {
  await as("clinicianA");
});

describe("prescription Server Actions against the test project", () => {
  it("returns UNAUTHENTICATED without a session", async () => {
    await as("anon");
    const result = await actions.createPrescriptionDraft(draftInput(PATIENTS.northThree, MEDICATIONS.morivane));
    expect(result).toMatchObject({ ok: false, errors: { code: "UNAUTHENTICATED" } });
  });

  it("returns FORBIDDEN for admins and NOT_FOUND for another team's patient", async () => {
    await as("admin");
    expect(await actions.createPrescriptionDraft(draftInput(PATIENTS.northThree, MEDICATIONS.morivane))).toMatchObject({
      ok: false,
      errors: { code: "FORBIDDEN" },
    });
    await as("clinicianB");
    expect(await actions.createPrescriptionDraft(draftInput(PATIENTS.northThree, MEDICATIONS.morivane))).toMatchObject({
      ok: false,
      errors: { code: "NOT_FOUND" },
    });
  });

  it("returns typed validation errors", async () => {
    const result = await actions.createPrescriptionDraft({ ...draftInput(PATIENTS.northThree, MEDICATIONS.morivane), quantity: "0" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.code).toBe("VALIDATION");
      expect(result.errors.fieldErrors.quantity?.length).toBeGreaterThan(0);
    }
  });

  it("treats a repeated submission as the same draft", async () => {
    const input = draftInput(PATIENTS.northThree, MEDICATIONS.morivane);
    const first = await actions.createPrescriptionDraft(input);
    const second = await actions.createPrescriptionDraft(input);
    expect(first.ok && second.ok).toBe(true);
    if (first.ok && second.ok) {
      expect(second.data).toEqual({ prescriptionId: first.data.prescriptionId, duplicate: true });
    }
  });

  it("reports version conflicts and prescriber-only edits", async () => {
    const prescriptionId = await createDraft(PATIENTS.northThree, MEDICATIONS.morivane);
    const edit = { ...draftInput(PATIENTS.northThree, MEDICATIONS.morivane), prescriptionId, expectedVersion: "1", quantity: "60" };
    expect(await actions.updatePrescriptionDraft(edit)).toEqual({ ok: true, data: { version: 2 } });
    expect(await actions.updatePrescriptionDraft(edit)).toMatchObject({ ok: false, errors: { code: "CONFLICT" } });
    await as("clinicianA2");
    expect(await actions.updatePrescriptionDraft({ ...edit, expectedVersion: "2" })).toMatchObject({
      ok: false,
      errors: { code: "FORBIDDEN" },
    });
  });

  it("blocks signing on a blocking alert and signs after advisories are acknowledged", async () => {
    const blocked = await createDraft(PATIENTS.northOne, MEDICATIONS.zentoril);
    const ids = { patientId: PATIENTS.northOne, prescriptionId: blocked };
    expect(await actions.signPrescription({ ...ids, expectedVersion: "1", attestation: "on" })).toMatchObject({
      ok: false,
      errors: { code: "RULE_VIOLATION" },
    });
    const { data: persisted } = await current.from("prescription_alerts").select("severity").eq("prescription_id", blocked);
    expect(persisted?.map((a) => a.severity)).toEqual(["blocking"]);

    const advisory = await createDraft(PATIENTS.northTwo, MEDICATIONS.calvexa);
    const advisoryIds = { patientId: PATIENTS.northTwo, prescriptionId: advisory };
    expect(await actions.evaluatePrescription(advisoryIds)).toMatchObject({ ok: true, data: { advisoryPending: 1 } });
    const { data: alerts } = await current.from("prescription_alerts").select("id").eq("prescription_id", advisory);
    expect(await actions.acknowledgeAlert({ ...advisoryIds, alertId: alerts![0]!.id, reason: "Reviewed" })).toMatchObject({ ok: true });
    expect(await actions.signPrescription({ ...advisoryIds, expectedVersion: "1", attestation: "on" })).toEqual({
      ok: true,
      data: { prescriptionId: advisory },
    });
    const { data: meds } = await current.from("patient_medications").select("id").eq("source_prescription_id", advisory);
    expect(meds).toHaveLength(1);
  });
});
