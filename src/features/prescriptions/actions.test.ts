import { beforeEach, describe, expect, it, vi } from "vitest";

const authorizeAction = vi.fn();
const createClient = vi.fn();

vi.mock("@/lib/auth/guards", () => ({ authorizeAction }));
vi.mock("@/lib/supabase/server", () => ({ createClient }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

const actions = await import("./actions");

const clinician = { ok: true, user: { id: "a0000000-0000-4000-8000-000000000001", fullName: "A", role: "clinician" } };
const unauthenticated = { ok: false, result: { ok: false, errors: { code: "UNAUTHENTICATED", formErrors: ["x"], fieldErrors: {} } } };

const calls: [string, (input: unknown) => Promise<unknown>][] = [
  ["createPrescriptionDraft", actions.createPrescriptionDraft],
  ["updatePrescriptionDraft", actions.updatePrescriptionDraft],
  ["evaluatePrescription", actions.evaluatePrescription],
  ["acknowledgeAlert", actions.acknowledgeAlert],
  ["signPrescription", actions.signPrescription],
  ["cancelPrescription", actions.cancelPrescription],
];

beforeEach(() => {
  authorizeAction.mockReset();
  createClient.mockReset();
});

describe("prescription actions", () => {
  it.each(calls)("%s requires the clinician role and stops before touching the database", async (_name, action) => {
    authorizeAction.mockResolvedValue(unauthenticated);
    const result = await action({});
    expect(authorizeAction).toHaveBeenCalledWith("clinician");
    expect(result).toEqual(unauthenticated.result);
    expect(createClient).not.toHaveBeenCalled();
  });

  it.each(calls)("%s rejects malformed input with field errors and no database call", async (_name, action) => {
    authorizeAction.mockResolvedValue(clinician);
    const result = (await action({ patientId: "not-a-uuid" })) as { ok: boolean; errors: { code: string; fieldErrors: object } };
    expect(result.ok).toBe(false);
    expect(result.errors.code).toBe("VALIDATION");
    expect(result.errors.fieldErrors).toHaveProperty("patientId");
    expect(createClient).not.toHaveBeenCalled();
  });

  it("requires the attestation to sign", async () => {
    authorizeAction.mockResolvedValue(clinician);
    const result = (await actions.signPrescription({
      patientId: "9a000000-0000-4000-8000-000000000001",
      prescriptionId: "9a000000-0000-4000-8000-000000000002",
      expectedVersion: "1",
    })) as { ok: boolean; errors: { fieldErrors: object } };
    expect(result.ok).toBe(false);
    expect(result.errors.fieldErrors).toHaveProperty("attestation");
    expect(createClient).not.toHaveBeenCalled();
  });
});
