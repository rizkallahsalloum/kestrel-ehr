import { afterAll, describe, expect, it } from "vitest";
import { ALLERGIES, IDENTITIES, MEDICATIONS, PATIENT_MEDICATIONS, PATIENTS } from "../../scripts/fixtures.ts";
import { closePool, withTx, type Tx } from "../helpers/db";

afterAll(closePool);

const PERMISSION_DENIED = "42501";

async function count(tx: Tx, sql: string, params: unknown[] = []): Promise<number> {
  const result = await tx.query<{ count: string }>(`select count(*) from (${sql}) q`, params);
  return Number(result.rows[0]?.count ?? 0);
}

describe("catalog and rules", () => {
  it("are readable by active users only", async () => {
    await withTx(async (tx) => {
      for (const actor of ["clinicianA", "admin"] as const) {
        await tx.as(actor);
        expect(await count(tx, "select id from public.medications")).toBeGreaterThan(0);
        expect(await count(tx, "select id from public.interaction_rules")).toBeGreaterThan(0);
      }
      await tx.as("inactive");
      expect(await count(tx, "select id from public.medications")).toBe(0);
      await tx.as("anon");
      await tx.expectError("select id from public.medications", [], PERMISSION_DENIED);
    });
  });

  it("cannot be modified through the API", async () => {
    await withTx(async (tx) => {
      for (const actor of ["clinicianA", "admin"] as const) {
        await tx.as(actor);
        await tx.expectError("update public.interaction_rules set is_active = false", [], PERMISSION_DENIED);
        await tx.expectError(
          "insert into public.medications (name, strength, form, drug_class_code) values ('X', '1 mg', 'tablet', 'DEMO-ALPHA')",
          [],
          PERMISSION_DENIED,
        );
        await tx.expectError("delete from public.drug_classes", [], PERMISSION_DENIED);
      }
    });
  });

  it("enforces fictional naming and rule shape constraints", async () => {
    await withTx(async (tx) => {
      await tx.as("postgres");
      await tx.expectError("insert into public.drug_classes (code, name) values ('ACE', 'Real class')", [], "23514");
      await tx.expectError(
        "insert into public.interaction_rules (rule_code, rule_type, class_a, severity, message) values ('DEMO-R900', 'interaction_class', 'DEMO-ALPHA', 'advisory', 'DEMO RULE x')",
        [],
        "23514",
      );
      await tx.expectError(
        "insert into public.interaction_rules (rule_code, rule_type, class_a, severity, message) values ('DEMO-R901', 'allergy_class', 'DEMO-ALPHA', 'blocking', 'Real guidance')",
        [],
        "23514",
      );
      await tx.expectError(
        "insert into public.patients (mrn, given_name, family_name, date_of_birth, sex, care_team_id, is_synthetic) values ('MRN-1', 'A', 'B', '2000-01-01', 'female', (select id from public.care_teams limit 1), false)",
        [],
        "23514",
      );
    });
  });
});

describe("allergies and patient medications", () => {
  it("are visible to the patient's care team only", async () => {
    await withTx(async (tx) => {
      await tx.as("clinicianA");
      expect(await count(tx, "select id from public.allergies where patient_id = $1", [PATIENTS.northOne])).toBe(2);
      expect(await count(tx, "select id from public.allergies where patient_id = $1", [PATIENTS.southOne])).toBe(0);
      expect(
        await count(tx, "select id from public.patient_medications where patient_id = $1", [PATIENTS.southOne]),
      ).toBe(0);
      await tx.as("clinicianB");
      expect(await count(tx, "select id from public.allergies where id = $1", [ALLERGIES.northOneAlphaActive])).toBe(0);
      expect(await count(tx, "select id from public.allergies where id = $1", [ALLERGIES.southOneGammaActive])).toBe(1);
    });
  });

  it("are not visible to admins", async () => {
    await withTx(async (tx) => {
      await tx.as("admin");
      expect(await count(tx, "select id from public.allergies")).toBe(0);
      expect(await count(tx, "select id from public.patient_medications")).toBe(0);
    });
  });

  it("cannot be written directly by clinicians", async () => {
    await withTx(async (tx) => {
      await tx.as("clinicianA");
      await tx.expectError(
        "update public.allergies set status = 'inactive' where id = $1",
        [ALLERGIES.northOneAlphaActive],
        PERMISSION_DENIED,
      );
      await tx.expectError(
        "insert into public.patient_medications (patient_id, medication_id, start_date, recorded_by) values ($1, $2, current_date, $3)",
        [PATIENTS.northOne, MEDICATIONS.calvexa, IDENTITIES.clinicianA.id],
        PERMISSION_DENIED,
      );
      await tx.expectError(
        "delete from public.patient_medications where id = $1",
        [PATIENT_MEDICATIONS.northOneTessalineActive],
        PERMISSION_DENIED,
      );
    });
  });

  it("rejects end dates before start dates", async () => {
    await withTx(async (tx) => {
      await tx.as("postgres");
      await tx.expectError(
        "update public.patient_medications set end_date = start_date - 1 where id = $1",
        [PATIENT_MEDICATIONS.northOneTessalineActive],
        "23514",
      );
    });
  });
});
