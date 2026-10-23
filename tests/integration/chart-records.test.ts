import { beforeEach, describe, expect, it, vi } from "vitest";
import { DIAGNOSES, IDENTITIES, PATIENTS, type IdentityKey } from "../../scripts/fixtures.ts";
import { anonClient, clientFor, type TypedClient } from "../helpers/supabase";

// Server Actions run with whichever Supabase client the test selects, so the real RLS policies and
// database functions decide every outcome. Each test leaves the seeded rows as it found them
// (status and description restored); versions and revisions only grow.
let current: TypedClient;
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => current }));
const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

const diagnoses = await import("@/features/diagnoses/actions");
const notes = await import("@/features/encounter-notes/actions");

async function as(key: IdentityKey | "anon") {
  current = key === "anon" ? anonClient() : await clientFor(key);
}

async function diagnosis(id: string) {
  const { data, error } = await current.from("diagnoses").select("status, description, version").eq("id", id).single();
  if (error) throw error;
  return data;
}

async function auditActions(entityId: string): Promise<string[]> {
  const admin = await clientFor("admin");
  const { data } = await admin.rpc("admin_list_audit_events", { p_limit: 100 });
  return (data ?? []).filter((e) => e.entity_id === entityId).map((e) => e.action);
}

beforeEach(async () => {
  revalidatePath.mockClear();
  await as("clinicianA");
});

describe("diagnosis Server Actions against the test project", () => {
  it("returns UNAUTHENTICATED, FORBIDDEN and NOT_FOUND before touching the row", async () => {
    const { version } = await diagnosis(DIAGNOSES.northOneLipids);
    const input = { diagnosisId: DIAGNOSES.northOneLipids, status: "resolved", expectedVersion: version };
    await as("anon");
    expect(await diagnoses.setDiagnosisStatus(input)).toMatchObject({ ok: false, errors: { code: "UNAUTHENTICATED" } });
    await as("admin");
    expect(await diagnoses.setDiagnosisStatus(input)).toMatchObject({ ok: false, errors: { code: "FORBIDDEN" } });
    await as("clinicianB");
    expect(await diagnoses.setDiagnosisStatus(input)).toMatchObject({
      ok: false,
      errors: { code: "NOT_FOUND" },
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("validates input with the shared schema", async () => {
    const result = await diagnoses.updateDiagnosisDescription({ diagnosisId: DIAGNOSES.northOneLipids, description: "   ", expectedVersion: 1 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.code).toBe("VALIDATION");
      expect(result.errors.fieldErrors.description?.length).toBeGreaterThan(0);
    }
  });

  it("resolves and reopens with version checks, audit rows and route invalidation", async () => {
    const before = await diagnosis(DIAGNOSES.northOneHypertension);
    expect(before.status).toBe("active");

    const resolved = await diagnoses.setDiagnosisStatus({
      diagnosisId: DIAGNOSES.northOneHypertension,
      status: "resolved",
      expectedVersion: before.version,
    });
    expect(resolved).toEqual({ ok: true, data: { id: DIAGNOSES.northOneHypertension, status: "resolved", version: before.version + 1 } });
    expect(revalidatePath).toHaveBeenCalledWith("/", "layout");

    expect(
      await diagnoses.setDiagnosisStatus({ diagnosisId: DIAGNOSES.northOneHypertension, status: "active", expectedVersion: before.version }),
    ).toMatchObject({ ok: false, errors: { code: "CONFLICT" } });
    expect(
      await diagnoses.setDiagnosisStatus({ diagnosisId: DIAGNOSES.northOneHypertension, status: "resolved", expectedVersion: before.version + 1 }),
    ).toMatchObject({ ok: false, errors: { code: "CONFLICT" } });

    await as("clinicianA2");
    const reopened = await diagnoses.setDiagnosisStatus({
      diagnosisId: DIAGNOSES.northOneHypertension,
      status: "active",
      expectedVersion: before.version + 1,
    });
    expect(reopened).toMatchObject({ ok: true, data: { status: "active", version: before.version + 2 } });

    const actions = await auditActions(DIAGNOSES.northOneHypertension);
    expect(actions).toContain("diagnosis.resolved");
    expect(actions).toContain("diagnosis.reopened");
  });

  it("edits the description and restores it", async () => {
    const before = await diagnosis(DIAGNOSES.northOneLipids);
    const edited = await diagnoses.updateDiagnosisDescription({
      diagnosisId: DIAGNOSES.northOneLipids,
      description: `${before.description} (synthetic edit)`,
      expectedVersion: before.version,
    });
    expect(edited).toMatchObject({ ok: true, data: { version: before.version + 1 } });
    expect((await diagnosis(DIAGNOSES.northOneLipids)).description).toBe(`${before.description} (synthetic edit)`);

    const restored = await diagnoses.updateDiagnosisDescription({
      diagnosisId: DIAGNOSES.northOneLipids,
      description: before.description,
      expectedVersion: before.version + 1,
    });
    expect(restored).toMatchObject({ ok: true, data: { version: before.version + 2 } });
    expect(await auditActions(DIAGNOSES.northOneLipids)).toContain("diagnosis.updated");
  });
});

describe("encounter note autosave against the test project", () => {
  const patientId = PATIENTS.northThree;
  const today = new Date().toISOString().slice(0, 10);

  async function ownNoteToday() {
    const { data, error } = await current
      .from("encounter_notes")
      .select("id, version, body")
      .eq("patient_id", patientId)
      .eq("author_id", IDENTITIES.clinicianA.id)
      .eq("note_date", today)
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  it("creates or updates the author's note for today, reports stale versions, and audits each version", async () => {
    let note = await ownNoteToday();
    if (!note) {
      expect(await notes.saveEncounterNote({ patientId, noteId: null, expectedVersion: null, body: "   " })).toMatchObject({
        ok: false,
        errors: { code: "VALIDATION" },
      });
      const created = await notes.saveEncounterNote({ patientId, noteId: null, expectedVersion: null, body: "Synthetic note (integration)." });
      expect(created).toMatchObject({ ok: true, data: { version: 1 } });
      note = await ownNoteToday();
    } else {
      // A second "create" for the same day is a conflict, not a second note.
      expect(await notes.saveEncounterNote({ patientId, noteId: null, expectedVersion: null, body: "x" })).toMatchObject({
        ok: false,
        errors: { code: "CONFLICT" },
      });
    }
    const body = `Synthetic note (integration) ${Date.now()}.`;
    const saved = await notes.saveEncounterNote({ patientId, noteId: note!.id, expectedVersion: note!.version, body });
    expect(saved).toMatchObject({ ok: true, data: { noteId: note!.id, version: note!.version + 1 } });
    expect((await ownNoteToday())!.body).toBe(body);
    expect(revalidatePath).toHaveBeenLastCalledWith("/", "layout");

    expect(await notes.saveEncounterNote({ patientId, noteId: note!.id, expectedVersion: note!.version, body: "stale" })).toMatchObject({
      ok: false,
      errors: { code: "CONFLICT" },
    });
    expect((await ownNoteToday())!.body).toBe(body);

    const actions = await auditActions(note!.id);
    expect(actions).toContain("encounter_note.updated");
  });

  it("another clinician cannot overwrite the note, and another team cannot write one", async () => {
    const note = await ownNoteToday();
    if (note) {
      await as("clinicianA2");
      expect(await notes.saveEncounterNote({ patientId, noteId: note.id, expectedVersion: note.version, body: "not mine" })).toMatchObject({
        ok: false,
        errors: { code: "CONFLICT" },
      });
    }
    await as("clinicianB");
    const result = await notes.saveEncounterNote({ patientId, noteId: null, expectedVersion: null, body: "Synthetic note" });
    expect(result.ok).toBe(false);
  });
});
