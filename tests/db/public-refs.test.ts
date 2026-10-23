import { afterAll, describe, expect, it } from "vitest";
import { IDENTITIES, MEDICATIONS, PATIENTS } from "../../scripts/fixtures.ts";
import { closePool, withTx } from "../helpers/db";

afterAll(closePool);

const FORMAT = /^[0-9a-hjkmnp-tv-z]{10}$/;

describe("opaque URL references", () => {
  it("every patient and prescription has a unique, well-formed reference", async () => {
    await withTx(async (tx) => {
      for (const table of ["patients", "prescriptions"]) {
        const { rows } = await tx.query<{ public_ref: string }>(`select public_ref from public.${table}`);
        expect(rows.length).toBeGreaterThan(0);
        for (const row of rows) expect(row.public_ref).toMatch(FORMAT);
        expect(new Set(rows.map((r) => r.public_ref)).size).toBe(rows.length);
      }
      await tx.expectError("update public.patients set public_ref = 'abc' where id = $1", [PATIENTS.northOne], "23514");
    });
  });

  it("assigns a fresh reference on insert and ignores a supplied one", async () => {
    await withTx(async (tx) => {
      const { rows } = await tx.query<{ public_ref: string }>(
        `insert into public.prescriptions (patient_id, medication_id, prescriber_id, dose_amount, dose_unit, route,
           frequency, quantity, start_date, idempotency_key, public_ref)
         values ($1, $2, $3, 1, 'mg', 'oral', 'once_daily', 1, current_date, gen_random_uuid(), 'aaaaaaaaaa')
         returning public_ref`,
        [PATIENTS.northThree, MEDICATIONS.morivane, IDENTITIES.clinicianA.id],
      );
      expect(rows[0]!.public_ref).toMatch(FORMAT);
      expect(rows[0]!.public_ref).not.toBe("aaaaaaaaaa");
    });
  });

  it("clinicians can read references of their own team only and can never write them", async () => {
    await withTx(async (tx) => {
      await tx.as("clinicianA");
      const own = await tx.query("select public_ref from public.patients where id = $1", [PATIENTS.northOne]);
      expect(own.rows).toHaveLength(1);
      const other = await tx.query("select public_ref from public.patients where id = $1", [PATIENTS.southOne]);
      expect(other.rows).toHaveLength(0);
      await tx.expectError("update public.prescriptions set public_ref = 'bbbbbbbbbb'", [], "42501");
      await tx.expectError(
        `insert into public.prescriptions (patient_id, medication_id, prescriber_id, dose_amount, dose_unit, route,
           frequency, quantity, start_date, idempotency_key, public_ref)
         values ($1, $2, auth.uid(), 1, 'mg', 'oral', 'once_daily', 1, current_date, gen_random_uuid(), 'cccccccccc')`,
        [PATIENTS.northThree, MEDICATIONS.morivane],
        "42501",
      );
      const inserted = await tx.query<{ public_ref: string }>(
        `insert into public.prescriptions (patient_id, medication_id, prescriber_id, dose_amount, dose_unit, route,
           frequency, quantity, start_date, idempotency_key)
         values ($1, $2, auth.uid(), 1, 'mg', 'oral', 'once_daily', 1, current_date, gen_random_uuid())
         returning public_ref`,
        [PATIENTS.northThree, MEDICATIONS.morivane],
      );
      expect(inserted.rows[0]!.public_ref).toMatch(FORMAT);
    });
  });

  it("anonymous callers cannot read references", async () => {
    await withTx(async (tx) => {
      await tx.as("anon");
      await tx.expectError("select public_ref from public.patients", [], "42501");
    });
  });
});
