import { afterAll, describe, expect, it } from "vitest";
import { IDENTITIES, MEDICATIONS, PATIENTS, type IdentityKey } from "../../scripts/fixtures.ts";
import { PRESCRIPTION_TRANSITIONS } from "../../src/features/prescriptions/transitions.ts";
import { closePool, withTx, type Tx } from "../helpers/db";

afterAll(closePool);

const PERMISSION_DENIED = "42501";
const NOT_FOUND = "P0002";

type DraftInput = { patientId?: string; medicationId?: string; startDate?: string; prescriberId?: string };

/** Inserts a draft as the current actor through the same columns the app uses. */
async function insertDraft(tx: Tx, input: DraftInput = {}): Promise<string> {
  const result = await tx.query<{ id: string }>(
    `insert into public.prescriptions
       (patient_id, medication_id, prescriber_id, dose_amount, dose_unit, route, frequency,
        quantity, refills, start_date, idempotency_key)
     values ($1, $2, coalesce($3::uuid, auth.uid()), 10, 'mg', 'oral', 'once_daily', 30, 0,
             coalesce($4::date, current_date), gen_random_uuid())
     returning id`,
    [input.patientId ?? PATIENTS.northThree, input.medicationId ?? MEDICATIONS.morivane, input.prescriberId ?? null, input.startDate ?? null],
  );
  return result.rows[0]!.id;
}

async function draftAs(tx: Tx, actor: IdentityKey, input: DraftInput = {}): Promise<string> {
  await tx.as(actor);
  return insertDraft(tx, input);
}

async function prescriptionRow(tx: Tx, id: string) {
  await tx.as("postgres");
  const result = await tx.query<{ status: string; version: number; last_evaluated_version: number | null }>(
    "select status, version, last_evaluated_version from public.prescriptions where id = $1",
    [id],
  );
  return result.rows[0];
}

async function auditActions(tx: Tx, entityId: string): Promise<string[]> {
  await tx.as("postgres");
  const result = await tx.query<{ action: string }>(
    "select action from private.audit_logs where entity_id = $1 order by id",
    [entityId],
  );
  return result.rows.map((row) => row.action);
}

async function evaluate(tx: Tx, id: string) {
  const result = await tx.query<{ r: { version: number; blocking: number; advisoryPending: number; advisoryTotal: number } }>(
    "select public.evaluate_prescription_safety($1) as r",
    [id],
  );
  return result.rows[0]!.r;
}

async function currentAlerts(tx: Tx, id: string) {
  const result = await tx.query<{ id: string; severity: string; prescription_version: number }>(
    `select a.id, a.severity, a.prescription_version
     from public.prescription_alerts a
     join public.prescriptions p on p.id = a.prescription_id and p.version = a.prescription_version
     where a.prescription_id = $1 and a.resolved_at is null
     order by a.created_at`,
    [id],
  );
  return result.rows;
}

describe("prescription drafts", () => {
  it("uses the same statuses as the TypeScript transition map", async () => {
    await withTx(async (tx) => {
      const result = await tx.query<{ value: string }>(
        "select unnest(enum_range(null::public.prescription_status))::text as value",
      );
      expect(result.rows.map((r) => r.value).sort()).toEqual(Object.keys(PRESCRIPTION_TRANSITIONS).sort());
    });
  });

  it("lets a care-team clinician create a version-1 draft and audits it", async () => {
    await withTx(async (tx) => {
      const id = await draftAs(tx, "clinicianA");
      expect(await prescriptionRow(tx, id)).toMatchObject({ status: "draft", version: 1, last_evaluated_version: null });
      expect(await auditActions(tx, id)).toEqual(["prescription.created"]);
    });
  });

  it("does not allow writing lifecycle columns directly", async () => {
    await withTx(async (tx) => {
      await tx.as("clinicianA");
      await tx.expectError(
        `insert into public.prescriptions (patient_id, medication_id, prescriber_id, dose_amount, dose_unit, route,
           frequency, quantity, start_date, idempotency_key, status)
         values ($1, $2, auth.uid(), 1, 'mg', 'oral', 'once_daily', 1, current_date, gen_random_uuid(), 'signed')`,
        [PATIENTS.northThree, MEDICATIONS.morivane],
        PERMISSION_DENIED,
      );
      const id = await insertDraft(tx);
      for (const assignment of [
        "status = 'signed'",
        "version = 9",
        "last_evaluated_version = 1",
        "signed_at = now()",
        `patient_id = '${PATIENTS.northOne}'`,
        `prescriber_id = '${IDENTITIES.clinicianA2.id}'`,
      ]) {
        await tx.expectError(`update public.prescriptions set ${assignment} where id = $1`, [id], PERMISSION_DENIED);
      }
      await tx.expectError("delete from public.prescriptions where id = $1", [id], PERMISSION_DENIED);
    });
  });

  it("rejects drafts for other teams, by admins, by inactive users, or for another prescriber", async () => {
    await withTx(async (tx) => {
      await tx.as("clinicianA");
      await tx.expectError(
        "insert into public.prescriptions (patient_id, medication_id, prescriber_id, dose_amount, dose_unit, route, frequency, quantity, start_date, idempotency_key) values ($1, $2, auth.uid(), 1, 'mg', 'oral', 'once_daily', 1, current_date, gen_random_uuid())",
        [PATIENTS.southOne, MEDICATIONS.morivane],
        PERMISSION_DENIED,
      );
      await tx.expectError(
        "insert into public.prescriptions (patient_id, medication_id, prescriber_id, dose_amount, dose_unit, route, frequency, quantity, start_date, idempotency_key) values ($1, $2, $3, 1, 'mg', 'oral', 'once_daily', 1, current_date, gen_random_uuid())",
        [PATIENTS.northThree, MEDICATIONS.morivane, IDENTITIES.clinicianA2.id],
        PERMISSION_DENIED,
      );
      for (const actor of ["admin", "inactive"] as const) {
        await tx.as(actor);
        await tx.expectError(
          "insert into public.prescriptions (patient_id, medication_id, prescriber_id, dose_amount, dose_unit, route, frequency, quantity, start_date, idempotency_key) values ($1, $2, auth.uid(), 1, 'mg', 'oral', 'once_daily', 1, current_date, gen_random_uuid())",
          [PATIENTS.northThree, MEDICATIONS.morivane],
          PERMISSION_DENIED,
        );
      }
      await tx.as("anon");
      await tx.expectError("select id from public.prescriptions", [], PERMISSION_DENIED);
    });
  });

  it("bumps the version only when content changes and records changed fields", async () => {
    await withTx(async (tx) => {
      const id = await draftAs(tx, "clinicianA");
      await tx.query("update public.prescriptions set quantity = 60, instructions = 'Demo' where id = $1", [id]);
      expect((await prescriptionRow(tx, id))?.version).toBe(2);
      await tx.as("clinicianA");
      await tx.query("update public.prescriptions set quantity = 60 where id = $1", [id]);
      expect((await prescriptionRow(tx, id))?.version).toBe(2);
      const audit = await tx.query<{ metadata: { changed_fields: string[] } }>(
        "select metadata from private.audit_logs where entity_id = $1 and action = 'prescription.updated'",
        [id],
      );
      expect(audit.rows).toHaveLength(1);
      expect(audit.rows[0]!.metadata.changed_fields.sort()).toEqual(["instructions", "quantity"]);
    });
  });

  it("hides and protects a draft from everyone except its prescriber", async () => {
    await withTx(async (tx) => {
      const id = await draftAs(tx, "clinicianA");
      await tx.as("clinicianA2");
      expect((await tx.query("select id from public.prescriptions where id = $1", [id])).rowCount).toBe(1);
      const teammate = await tx.query("update public.prescriptions set quantity = 5 where id = $1 returning id", [id]);
      expect(teammate.rowCount).toBe(0);
      await tx.as("clinicianB");
      expect((await tx.query("select id from public.prescriptions where id = $1", [id])).rowCount).toBe(0);
      expect((await tx.query("update public.prescriptions set quantity = 5 where id = $1 returning id", [id])).rowCount).toBe(0);
      await tx.as("admin");
      expect((await tx.query("select id from public.prescriptions where id = $1", [id])).rowCount).toBe(0);
      expect((await prescriptionRow(tx, id))?.version).toBe(1);
    });
  });

  it("enforces the start-date window and active medications", async () => {
    await withTx(async (tx) => {
      await tx.as("clinicianA");
      await tx.expectError(
        "insert into public.prescriptions (patient_id, medication_id, prescriber_id, dose_amount, dose_unit, route, frequency, quantity, start_date, idempotency_key) values ($1, $2, auth.uid(), 1, 'mg', 'oral', 'once_daily', 1, current_date + 31, gen_random_uuid())",
        [PATIENTS.northThree, MEDICATIONS.morivane],
        "KE005",
      );
      await tx.expectError(
        "insert into public.prescriptions (patient_id, medication_id, prescriber_id, dose_amount, dose_unit, route, frequency, quantity, start_date, idempotency_key) values ($1, $2, auth.uid(), 1, 'mg', 'oral', 'once_daily', 1, current_date, gen_random_uuid())",
        [PATIENTS.northThree, MEDICATIONS.retiredDemo],
        "KE006",
      );
      const id = await insertDraft(tx);
      await tx.expectError("update public.prescriptions set start_date = current_date - 31 where id = $1", [id], "KE005");
      await tx.expectError("update public.prescriptions set medication_id = $2 where id = $1", [id, MEDICATIONS.retiredDemo], "KE006");
    });
  });

  it("rejects a second draft with the same idempotency key", async () => {
    await withTx(async (tx) => {
      await tx.as("clinicianA");
      const sql =
        "insert into public.prescriptions (patient_id, medication_id, prescriber_id, dose_amount, dose_unit, route, frequency, quantity, start_date, idempotency_key) values ($1, $2, auth.uid(), 1, 'mg', 'oral', 'once_daily', 1, current_date, $3)";
      const key = "11111111-1111-4111-8111-111111111111";
      await tx.query(sql, [PATIENTS.northThree, MEDICATIONS.morivane, key]);
      await tx.expectError(sql, [PATIENTS.northThree, MEDICATIONS.morivane, key], "23505");
    });
  });

  it("does not allow alerts or decisions to be written directly", async () => {
    await withTx(async (tx) => {
      const id = await draftAs(tx, "clinicianA", { patientId: PATIENTS.northOne, medicationId: MEDICATIONS.zentoril });
      await tx.expectError("update public.prescription_alerts set severity = 'advisory'", [], PERMISSION_DENIED);
      await tx.expectError(
        "insert into public.prescription_alerts (prescription_id, prescription_version, rule_id, severity, message, allergy_id) select $1, 1, id, 'advisory', 'x', null from public.interaction_rules limit 1",
        [id],
        PERMISSION_DENIED,
      );
      await tx.expectError(
        "insert into public.prescription_safety_decisions (alert_id, decided_by) values (gen_random_uuid(), auth.uid())",
        [],
        PERMISSION_DENIED,
      );
    });
  });
});

describe("safety evaluation and signing", () => {
  it("hard-stops on a blocking allergy alert, even through direct RPC calls", async () => {
    await withTx(async (tx) => {
      const id = await draftAs(tx, "clinicianA", { patientId: PATIENTS.northOne, medicationId: MEDICATIONS.zentoril });
      expect(await evaluate(tx, id)).toMatchObject({ version: 1, blocking: 1, advisoryPending: 0 });
      const [alert] = await currentAlerts(tx, id);
      expect(alert?.severity).toBe("blocking");
      await tx.expectError("select public.acknowledge_prescription_alert($1, 'override')", [alert!.id], "KE003");
      await tx.expectError("select public.sign_prescription($1, 1)", [id], "KE003");
      expect((await prescriptionRow(tx, id))?.status).toBe("draft");
    });
  });

  it("requires every advisory alert to be acknowledged before signing", async () => {
    await withTx(async (tx) => {
      const id = await draftAs(tx, "clinicianA", { patientId: PATIENTS.northTwo, medicationId: MEDICATIONS.calvexa });
      await tx.expectError("select public.sign_prescription($1, 1)", [id], "KE004");

      expect(await evaluate(tx, id)).toMatchObject({ blocking: 0, advisoryPending: 1, advisoryTotal: 1 });
      const [alert] = await currentAlerts(tx, id);
      const first = await tx.query<{ d: string }>("select public.acknowledge_prescription_alert($1, ' Reviewed ') as d", [alert!.id]);
      const again = await tx.query<{ d: string }>("select public.acknowledge_prescription_alert($1) as d", [alert!.id]);
      expect(again.rows[0]!.d).toBe(first.rows[0]!.d);

      const signed = await tx.query<{ r: { status: string; patientMedicationId: string } }>(
        "select public.sign_prescription($1, 1) as r",
        [id],
      );
      expect(signed.rows[0]!.r.status).toBe("signed");

      await tx.as("clinicianA");
      const med = await tx.query<{ status: string; dose_text: string; recorded_by: string }>(
        "select status, dose_text, recorded_by from public.patient_medications where source_prescription_id = $1",
        [id],
      );
      expect(med.rows).toEqual([{ status: "active", dose_text: "10 mg oral once daily", recorded_by: IDENTITIES.clinicianA.id }]);

      expect(await auditActions(tx, id)).toEqual([
        "prescription.created",
        "prescription.evaluated",
        "prescription.evaluated",
        "prescription.signed",
      ]);
      const ack = await tx.query("select 1 from private.audit_logs where action = 'alert.acknowledged' and entity_id = $1", [alert!.id]);
      expect(ack.rowCount).toBe(1);
    });
  });

  it("invalidates acknowledgements when the draft changes", async () => {
    await withTx(async (tx) => {
      const id = await draftAs(tx, "clinicianA", { patientId: PATIENTS.northTwo, medicationId: MEDICATIONS.calvexa });
      await evaluate(tx, id);
      const [oldAlert] = await currentAlerts(tx, id);
      await tx.query("select public.acknowledge_prescription_alert($1)", [oldAlert!.id]);

      await tx.query("update public.prescriptions set quantity = 90 where id = $1", [id]);
      await tx.expectError("select public.sign_prescription($1, 1)", [id], "KE002");
      await tx.expectError("select public.sign_prescription($1, 2)", [id], "KE004");
      await tx.expectError("select public.acknowledge_prescription_alert($1)", [oldAlert!.id], "KE007");

      expect(await evaluate(tx, id)).toMatchObject({ version: 2, advisoryPending: 1 });
      const [newAlert] = await currentAlerts(tx, id);
      expect(newAlert?.prescription_version).toBe(2);
      await tx.query("select public.acknowledge_prescription_alert($1)", [newAlert!.id]);
      await tx.query("select public.sign_prescription($1, 2)", [id]);
      expect((await prescriptionRow(tx, id))?.status).toBe("signed");
    });
  });

  it("resolves alerts that no longer apply after an edit and re-evaluation", async () => {
    await withTx(async (tx) => {
      const id = await draftAs(tx, "clinicianA", { patientId: PATIENTS.northOne, medicationId: MEDICATIONS.zentoril });
      await evaluate(tx, id);
      await tx.query("update public.prescriptions set medication_id = $2 where id = $1", [id, MEDICATIONS.ploxidrin]);
      expect(await evaluate(tx, id)).toMatchObject({ version: 2, blocking: 0, advisoryTotal: 0 });
      await tx.query("select public.sign_prescription($1, 2)", [id]);
      expect((await prescriptionRow(tx, id))?.status).toBe("signed");
    });
  });

  it("catches an allergy recorded after the last evaluation at sign time", async () => {
    await withTx(async (tx) => {
      const id = await draftAs(tx, "clinicianA", { patientId: PATIENTS.northThree, medicationId: MEDICATIONS.calvexa });
      expect(await evaluate(tx, id)).toMatchObject({ blocking: 0, advisoryTotal: 0 });
      await tx.as("postgres");
      await tx.query(
        "insert into public.allergies (patient_id, substance_text, drug_class_code, severity, status, recorded_by) values ($1, 'Demo beta class', 'DEMO-BETA', 'moderate', 'active', $2)",
        [PATIENTS.northThree, IDENTITIES.clinicianA.id],
      );
      await tx.as("clinicianA");
      await tx.expectError("select public.sign_prescription($1, 1)", [id], "KE003");
    });
  });

  it("keeps signed and cancelled prescriptions immutable", async () => {
    await withTx(async (tx) => {
      const signed = await draftAs(tx, "clinicianA");
      await tx.query("select public.sign_prescription($1, 1)", [signed]);
      const cancelled = await insertDraft(tx);
      await tx.query("select public.cancel_prescription($1, 1, ' Entered in error ')", [cancelled]);

      for (const id of [signed, cancelled]) {
        await tx.as("clinicianA");
        expect((await tx.query("update public.prescriptions set quantity = 1 where id = $1 returning id", [id])).rowCount).toBe(0);
        await tx.expectError("select public.sign_prescription($1, 1)", [id], "KE001");
        await tx.expectError("select public.cancel_prescription($1, 1)", [id], "KE001");
        await tx.expectError("select public.evaluate_prescription_safety($1)", [id], "KE001");
        await tx.as("postgres");
        await tx.expectError("update public.prescriptions set quantity = 1 where id = $1", [id], "KE001");
      }
      const row = await tx.query("select cancel_reason from public.prescriptions where id = $1", [cancelled]);
      expect(row.rows[0]).toEqual({ cancel_reason: "Entered in error" });
      expect(await auditActions(tx, cancelled)).toEqual(["prescription.created", "prescription.cancelled"]);
    });
  });

  it("rejects stale versions when cancelling", async () => {
    await withTx(async (tx) => {
      const id = await draftAs(tx, "clinicianA");
      await tx.query("update public.prescriptions set quantity = 2 where id = $1", [id]);
      await tx.expectError("select public.cancel_prescription($1, 1)", [id], "KE002");
    });
  });

  it("only lets the prescriber run workflow functions", async () => {
    await withTx(async (tx) => {
      const id = await draftAs(tx, "clinicianA");
      await tx.as("clinicianA2");
      for (const sql of [
        "select public.evaluate_prescription_safety($1)",
        "select public.sign_prescription($1, 1)",
        "select public.cancel_prescription($1, 1)",
      ]) {
        await tx.expectError(sql, [id], PERMISSION_DENIED);
      }
      for (const actor of ["clinicianB", "admin", "inactive"] as const) {
        await tx.as(actor);
        await tx.expectError("select public.sign_prescription($1, 1)", [id], NOT_FOUND);
      }
      await tx.as("anon");
      await tx.expectError("select public.sign_prescription($1, 1)", [id], PERMISSION_DENIED);
      expect((await prescriptionRow(tx, id))?.status).toBe("draft");
    });
  });

  it("rolls back the signature when the audit write fails", async () => {
    await withTx(async (tx) => {
      const id = await draftAs(tx, "clinicianA");
      await tx.as("postgres");
      await tx.query("alter table private.audit_logs add constraint audit_fail_test check (false) not valid");
      await tx.as("clinicianA");
      await tx.expectError("select public.sign_prescription($1, 1)", [id], "23514");
      expect(await prescriptionRow(tx, id)).toMatchObject({ status: "draft", last_evaluated_version: null });
      const meds = await tx.query("select 1 from public.patient_medications where source_prescription_id = $1", [id]);
      expect(meds.rowCount).toBe(0);
    });
  });
});
