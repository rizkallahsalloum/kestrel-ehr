import { afterAll, describe, expect, it } from "vitest";
import { DIAGNOSES, IDENTITIES, PATIENTS } from "../../scripts/fixtures.ts";
import { closePool, withTx, type Tx } from "../helpers/db";

afterAll(closePool);

/** Audit rows for the entity written after `afterId` (rows from earlier, committed runs are ignored). */
async function auditFor(tx: Tx, entityId: string, afterId = 0) {
  await tx.as("postgres");
  const { rows } = await tx.query<{ action: string; actor_id: string; metadata: Record<string, unknown> }>(
    "select action, actor_id, metadata from private.audit_logs where entity_id = $1 and id > $2 order by id",
    [entityId, afterId],
  );
  return rows;
}

/**
 * A diagnosis's current version and the last audit id, read as postgres at the start of a test.
 * The integration suite changes the same seeded diagnoses through the real Server Actions and
 * those changes commit: it restores status and text, but versions, revisions and audit rows only
 * grow. So these tests start from whatever version kestrel-test holds, not from 1.
 */
async function baseline(tx: Tx, diagnosisId: string) {
  await tx.as("postgres");
  const dx = await tx.query<{ version: number }>("select version from public.diagnoses where id = $1", [diagnosisId]);
  const audit = await tx.query<{ id: string }>("select coalesce(max(id), 0)::text as id from private.audit_logs");
  return { version: dx.rows[0]!.version, auditId: Number(audit.rows[0]!.id) };
}

describe("diagnoses, vitals and lab results: read access", () => {
  it("the care team reads them; another team and anonymous callers do not", async () => {
    await withTx(async (tx) => {
      await tx.as("clinicianA");
      for (const table of ["diagnoses", "vital_readings", "lab_results"]) {
        const own = await tx.query(`select 1 from public.${table} where patient_id = $1`, [PATIENTS.northOne]);
        expect(own.rows.length, table).toBeGreaterThan(0);
        const other = await tx.query(`select 1 from public.${table} where patient_id = $1`, [PATIENTS.southOne]);
        expect(other.rows, table).toHaveLength(0);
      }
      const revisions = await tx.query("select 1 from public.diagnosis_revisions where diagnosis_id = $1", [DIAGNOSES.northOneHypertension]);
      expect(revisions.rows.length).toBeGreaterThan(0);

      await tx.as("clinicianB");
      const hidden = await tx.query("select 1 from public.diagnosis_revisions where diagnosis_id = $1", [DIAGNOSES.northOneHypertension]);
      expect(hidden.rows).toHaveLength(0);

      await tx.as("anon");
      for (const table of ["diagnoses", "diagnosis_revisions", "vital_readings", "lab_results", "encounter_notes"]) {
        await tx.expectError(`select 1 from public.${table}`, [], "42501");
      }
    });
  });

  it("clinicians cannot write diagnoses, revisions, vitals or lab results directly", async () => {
    await withTx(async (tx) => {
      await tx.as("clinicianA");
      await tx.expectError("update public.diagnoses set description = 'x' where id = $1", [DIAGNOSES.northOneHypertension], "42501");
      await tx.expectError("delete from public.diagnoses where id = $1", [DIAGNOSES.northOneHypertension], "42501");
      await tx.expectError(
        "insert into public.diagnoses (patient_id, icd10_code, description, recorded_on, recorded_by) values ($1, 'I10', 'x', current_date, auth.uid())",
        [PATIENTS.northOne],
        "42501",
      );
      await tx.expectError("delete from public.diagnosis_revisions", [], "42501");
      await tx.expectError("update public.vital_readings set spo2 = 99", [], "42501");
      await tx.expectError("delete from public.lab_results", [], "42501");
    });
  });

  it("revisions are append-only even for the owner", async () => {
    await withTx(async (tx) => {
      await tx.expectError("update public.diagnosis_revisions set description = 'x'", [], "42501");
      await tx.expectError("delete from public.diagnosis_revisions", [], "42501");
    });
  });

  it("rejects implausible readings and malformed codes", async () => {
    await withTx(async (tx) => {
      await tx.expectError(
        "insert into public.vital_readings (patient_id, recorded_at, heart_rate, systolic, diastolic, spo2, temperature_f, recorded_by) values ($1, now(), 80, 120, 130, 98, 98.6, $2)",
        [PATIENTS.northOne, IDENTITIES.clinicianA.id],
        "23514",
      );
      await tx.expectError(
        "insert into public.lab_results (patient_id, test, value, unit, collected_on, recorded_by) values ($1, 'hba1c', 25, '%', current_date, $2)",
        [PATIENTS.northOne, IDENTITIES.clinicianA.id],
        "23514",
      );
      await tx.expectError(
        "insert into public.diagnoses (patient_id, icd10_code, description, recorded_on, recorded_by) values ($1, 'i10', 'x', current_date, $2)",
        [PATIENTS.northOne, IDENTITIES.clinicianA.id],
        "23514",
      );
    });
  });
});

describe("set_diagnosis_status and update_diagnosis_description", () => {
  it("any active clinician on the team resolves and reopens, with a revision and a content-free audit row", async () => {
    await withTx(async (tx) => {
      const { version: v, auditId } = await baseline(tx, DIAGNOSES.northOneHypertension);
      await tx.as("clinicianA2");
      const resolved = await tx.query<{ r: { status: string; version: number } }>(
        "select public.set_diagnosis_status($1, 'resolved', $2) as r",
        [DIAGNOSES.northOneHypertension, v],
      );
      expect(resolved.rows[0]!.r).toMatchObject({ status: "resolved", version: v + 1 });
      const row = await tx.query<{ resolved_on: string | null; resolved_by: string | null }>(
        "select resolved_on::text, resolved_by from public.diagnoses where id = $1",
        [DIAGNOSES.northOneHypertension],
      );
      expect(row.rows[0]!.resolved_by).toBe(IDENTITIES.clinicianA2.id);
      expect(row.rows[0]!.resolved_on).not.toBeNull();

      await tx.expectError("select public.set_diagnosis_status($1, 'resolved', $2)", [DIAGNOSES.northOneHypertension, v + 1], "KE009");
      await tx.expectError("select public.set_diagnosis_status($1, 'active', $2)", [DIAGNOSES.northOneHypertension, v], "KE008");

      const reopened = await tx.query<{ r: { status: string; version: number } }>(
        "select public.set_diagnosis_status($1, 'active', $2) as r",
        [DIAGNOSES.northOneHypertension, v + 1],
      );
      expect(reopened.rows[0]!.r).toMatchObject({ status: "active", version: v + 2 });

      const revisions = await tx.query<{ version: number; status: string }>(
        "select version, status from public.diagnosis_revisions where diagnosis_id = $1 and version >= $2 order by version",
        [DIAGNOSES.northOneHypertension, v],
      );
      expect(revisions.rows.map((r) => [r.version, r.status])).toEqual([
        [v, "active"],
        [v + 1, "resolved"],
        [v + 2, "active"],
      ]);

      const audit = await auditFor(tx, DIAGNOSES.northOneHypertension, auditId);
      expect(audit.map((a) => a.action)).toEqual(["diagnosis.resolved", "diagnosis.reopened"]);
      for (const entry of audit) {
        expect(entry.actor_id).toBe(IDENTITIES.clinicianA2.id);
        expect(Object.keys(entry.metadata).sort()).toEqual(["revision_id", "version"]);
      }
    });
  });

  it("edits the description (trimmed), keeps a revision and never puts the text in the audit log", async () => {
    await withTx(async (tx) => {
      const { version: v, auditId } = await baseline(tx, DIAGNOSES.northOneLipids);
      await tx.as("clinicianA");
      const updated = await tx.query<{ r: { version: number } }>(
        "select public.update_diagnosis_description($1, '  Hyperlipidemia, mixed (synthetic edit)  ', $2) as r",
        [DIAGNOSES.northOneLipids, v],
      );
      expect(updated.rows[0]!.r.version).toBe(v + 1);
      const row = await tx.query<{ description: string }>("select description from public.diagnoses where id = $1", [DIAGNOSES.northOneLipids]);
      expect(row.rows[0]!.description).toBe("Hyperlipidemia, mixed (synthetic edit)");

      const unchanged = await tx.query<{ r: { version: number } }>(
        "select public.update_diagnosis_description($1, 'Hyperlipidemia, mixed (synthetic edit)', $2) as r",
        [DIAGNOSES.northOneLipids, v + 1],
      );
      expect(unchanged.rows[0]!.r.version).toBe(v + 1);
      await tx.expectError("select public.update_diagnosis_description($1, 'Hyperlipidemia, stale', $2)", [DIAGNOSES.northOneLipids, v], "KE008");
      await tx.expectError("select public.update_diagnosis_description($1, '   ', $2)", [DIAGNOSES.northOneLipids, v + 1], "23514");

      const audit = await auditFor(tx, DIAGNOSES.northOneLipids, auditId);
      expect(audit.map((a) => a.action)).toEqual(["diagnosis.updated"]);
      expect(JSON.stringify(audit)).not.toContain("Hyperlipidemia");
    });
  });

  it("other teams, admins and inactive clinicians get not found", async () => {
    await withTx(async (tx) => {
      for (const actor of ["clinicianB", "admin", "inactive"] as const) {
        await tx.as(actor);
        await tx.expectError("select public.set_diagnosis_status($1, 'resolved', 1)", [DIAGNOSES.northOneHypertension], "P0002");
        await tx.expectError("select public.update_diagnosis_description($1, 'x', 1)", [DIAGNOSES.northOneHypertension], "P0002");
      }
      await tx.as("anon");
      await tx.expectError("select public.set_diagnosis_status($1, 'resolved', 1)", [DIAGNOSES.northOneHypertension], "42501");
    });
  });
});

describe("encounter notes", () => {
  const insertNote = "insert into public.encounter_notes (patient_id, author_id, body) values ($1, auth.uid(), $2) returning id, version, note_date::text";

  it("the author creates one note per patient and day; each body change is a new version with an audit row", async () => {
    await withTx(async (tx) => {
      // Inside this rolled-back transaction only: start from no note today, whatever other suites saved.
      await tx.query("delete from public.encounter_notes where patient_id = $1 and note_date = current_date", [PATIENTS.northThree]);
      await tx.as("clinicianA");
      const created = await tx.query<{ id: string; version: number; note_date: string }>(insertNote, [PATIENTS.northThree, "Synthetic note v1"]);
      const note = created.rows[0]!;
      expect(note.version).toBe(1);
      expect(note.note_date).toBe(new Date().toISOString().slice(0, 10));
      await tx.expectError(insertNote, [PATIENTS.northThree, "Second note today"], "23505");

      const v2 = await tx.query<{ version: number }>(
        "update public.encounter_notes set body = $2 where id = $1 and version = 1 returning version",
        [note.id, "Synthetic note v2"],
      );
      expect(v2.rows[0]!.version).toBe(2);
      const same = await tx.query<{ version: number }>(
        "update public.encounter_notes set body = $2 where id = $1 returning version",
        [note.id, "Synthetic note v2"],
      );
      expect(same.rows[0]!.version).toBe(2);
      const stale = await tx.query("update public.encounter_notes set body = 'x' where id = $1 and version = 1 returning id", [note.id]);
      expect(stale.rows).toHaveLength(0);

      await tx.expectError("update public.encounter_notes set patient_id = $2 where id = $1", [note.id, PATIENTS.northOne], "42501");
      await tx.expectError("update public.encounter_notes set body = repeat('x', 5001) where id = $1", [note.id], "23514");

      await tx.as("clinicianA2");
      const readable = await tx.query("select body from public.encounter_notes where id = $1", [note.id]);
      expect(readable.rows).toHaveLength(1);
      const edited = await tx.query("update public.encounter_notes set body = 'not mine' where id = $1 returning id", [note.id]);
      expect(edited.rows).toHaveLength(0);

      const audit = await auditFor(tx, note.id);
      expect(audit.map((a) => [a.action, a.metadata])).toEqual([
        ["encounter_note.created", { version: 1 }],
        ["encounter_note.updated", { version: 2 }],
      ]);
      expect(JSON.stringify(audit)).not.toContain("Synthetic note");
    });
  });

  it("nobody writes a note as someone else or for another team's patient", async () => {
    await withTx(async (tx) => {
      await tx.as("clinicianA");
      await tx.expectError(
        "insert into public.encounter_notes (patient_id, author_id, body) values ($1, $2, 'x')",
        [PATIENTS.northOne, IDENTITIES.clinicianA2.id],
        "42501",
      );
      await tx.expectError(insertNote, [PATIENTS.southOne, "x"], "42501");
      await tx.as("admin");
      await tx.expectError(insertNote, [PATIENTS.northOne, "x"], "42501");
      await tx.as("inactive");
      await tx.expectError(insertNote, [PATIENTS.northOne, "x"], "42501");
      await tx.as("clinicianB");
      const hidden = await tx.query("select 1 from public.encounter_notes where patient_id = $1", [PATIENTS.northOne]);
      expect(hidden.rows).toHaveLength(0);
    });
  });
});
