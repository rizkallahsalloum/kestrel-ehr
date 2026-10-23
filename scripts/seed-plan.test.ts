import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { IDENTITIES, PATIENTS, TEAMS } from "./fixtures";
import {
  devSeedBlockers,
  needsExistingClinicianSignIn,
  parseSeedSql,
  planSeedPrescription,
  SeedSqlError,
  seededPatientVisibility,
  type DevReport,
} from "./seed-plan";

const { inserts, otherStatements } = parseSeedSql(readFileSync(resolve("supabase/seed/synthetic.sql"), "utf8"));
const byTable = (table: string) => inserts.find((insert) => insert.table === table)!;
const column = (table: string, name: string) => byTable(table).rows.map((row) => row[byTable(table).columns.indexOf(name)]);

describe("synthetic seed SQL plan", () => {
  it("reads every insert with the expected row counts", () => {
    expect(Object.fromEntries(inserts.map((insert) => [insert.table, insert.rows.length]))).toEqual({
      care_teams: 2,
      care_team_members: 4,
      patients: 5,
      drug_classes: 4,
      medications: 6,
      interaction_rules: 4,
      allergies: 3,
      patient_medications: 4,
      diagnoses: 10,
      vital_readings: 30,
      lab_results: 7,
    });
  });

  it("leaves only the two profile updates for seed-created users outside the inserts", () => {
    expect(otherStatements).toHaveLength(2);
    expect(otherStatements.every((statement) => /^update public\.profiles set/.test(statement))).toBe(true);
    expect(otherStatements.join(" ")).toContain(IDENTITIES.admin.id);
    expect(otherStatements.join(" ")).toContain(IDENTITIES.inactive.id);
  });

  it("uses the fixture ids and only synthetic patients and teams", () => {
    expect(column("patients", "id")).toEqual(Object.values(PATIENTS));
    expect(column("patients", "mrn").every((mrn) => /^SYN-\d{6}$/.test(String(mrn)))).toBe(true);
    expect(column("care_teams", "id")).toEqual(Object.values(TEAMS));
    expect(column("care_teams", "name").every((name) => String(name).endsWith("(synthetic)"))).toBe(true);
    expect(column("medications", "drug_class_code").every((code) => String(code).startsWith("DEMO-"))).toBe(true);
    expect(column("interaction_rules", "rule_code").every((code) => String(code).startsWith("DEMO-R"))).toBe(true);
  });

  it("keeps quotes, commas and parentheses inside strings and types the literals", () => {
    const parsed = parseSeedSql(
      "insert into public.care_teams (id, name) values ('x', 'It''s (a, b)'), ('y', null) on conflict (id) do nothing;" +
        "insert into public.lab_results (patient_id, test, collected_on, value) values ('p', 'hba1c', '2026-01-01', 7.8) on conflict do nothing;",
    );
    expect(parsed.inserts[0]!.rows).toEqual([["x", "It's (a, b)"], ["y", null]]);
    expect(parsed.inserts[1]!.rows[0]![3]).toBe(7.8);
  });

  it("refuses a table without a natural key", () => {
    expect(() => parseSeedSql("insert into public.mystery (id) values ('x');")).toThrow(SeedSqlError);
  });
});

function report(overrides: Partial<DevReport> = {}): DevReport {
  return {
    migrationHistoryFound: true,
    pendingMigrations: [],
    missingTables: [],
    tables: [{ table: "patients", missing: false, rows: [{ key: PATIENTS.northOne, status: "new" }], foreignCount: 0, foreignSample: [] }],
    identities: [{ email: IDENTITIES.clinicianA.email, status: "new" }],
    otherAccounts: [],
    prescriptions: [],
    ...overrides,
  };
}

describe("Dev seed blockers", () => {
  it("allows a clean project and a repeat run", () => {
    expect(devSeedBlockers(report())).toEqual([]);
    expect(
      devSeedBlockers(
        report({
          tables: [{ table: "patients", missing: false, rows: [{ key: PATIENTS.northOne, status: "present" }], foreignCount: 0, foreignSample: [] }],
          identities: [{ email: IDENTITIES.clinicianA.email, status: "present" }],
        }),
      ),
    ).toEqual([]);
  });

  it("stops when Dev holds rows the seed did not create", () => {
    const blockers = devSeedBlockers(
      report({ tables: [{ table: "patients", missing: false, rows: [], foreignCount: 3, foreignSample: ["SYN-999999 A B"] }] }),
    );
    expect(blockers.join(" ")).toMatch(/public\.patients holds 3 row\(s\) the seed did not create/);
  });

  it.each(["prescriptions", "patient_medications"])("reports, but does not stop on, %s rows the seed did not create", (table) => {
    expect(
      devSeedBlockers(report({ tables: [{ table, missing: false, rows: [], foreignCount: 4, foreignSample: ["existing"] }] })),
    ).toEqual([]);
  });

  it("still stops on a patient_medications row with the seed's key but different values", () => {
    const blockers = devSeedBlockers(
      report({ tables: [{ table: "patient_medications", missing: false, rows: [{ key: "x", status: "conflict" }], foreignCount: 0, foreignSample: [] }] }),
    );
    expect(blockers).toHaveLength(1);
  });

  it.each(["care_teams", "care_team_members", "allergies", "diagnoses", "vital_readings", "lab_results", "encounter_notes"])(
    "still stops on %s rows the seed did not create",
    (table) => {
      expect(devSeedBlockers(report({ tables: [{ table, missing: false, rows: [], foreignCount: 1, foreignSample: [] }] }))).toHaveLength(1);
    },
  );

  it("stops on a row with the seed's key but different values", () => {
    const blockers = devSeedBlockers(
      report({ tables: [{ table: "patients", missing: false, rows: [{ key: PATIENTS.northOne, status: "conflict" }], foreignCount: 0, foreignSample: [] }] }),
    );
    expect(blockers.join(" ")).toMatch(/different values/);
  });

  it("stops on pending migrations, missing tables and account conflicts", () => {
    const blockers = devSeedBlockers(
      report({
        pendingMigrations: ["20261019000014_observations.sql"],
        missingTables: ["vital_readings"],
        identities: [{ email: IDENTITIES.clinicianA.email, status: "conflict", detail: "taken" }],
      }),
    );
    expect(blockers).toHaveLength(3);
  });

  it("stops when the migration history cannot be read", () => {
    expect(devSeedBlockers(report({ migrationHistoryFound: false }))).toHaveLength(1);
  });
});

describe("seed prescriptions and existing signed prescriptions", () => {
  const dup = { status: "duplicate" as const, detail: "the patient already has 1 signed prescription(s) of the same medication" };
  const alert = { status: "alert" as const, detail: "it would raise DEMO-R004 (advisory)" };

  it("skips a new or draft seed prescription when the same medication is already signed", () => {
    expect(planSeedPrescription("Rowan", undefined, dup)).toEqual({ label: "Rowan", status: "duplicate", detail: dup.detail });
    expect(planSeedPrescription("Rowan", "draft", dup).status).toBe("duplicate");
  });

  it("skips a seed prescription that would raise a DEMO alert", () => {
    expect(planSeedPrescription("Rowan", undefined, alert)).toEqual({ label: "Rowan", status: "alert", detail: alert.detail });
  });

  it("creates one when there is no duplicate, and leaves finished ones alone", () => {
    expect(planSeedPrescription("Rowan", undefined, undefined).status).toBe("new");
    expect(planSeedPrescription("Rowan", "signed", dup).status).toBe("signed");
    expect(planSeedPrescription("Rowan", "cancelled", undefined).status).toBe("cancelled");
  });
});

describe("clinician sign-in check before writing", () => {
  const email = IDENTITIES.clinicianA.email;
  const withRx = (status: "new" | "draft" | "signed" | "duplicate", identity: "new" | "present") =>
    report({ identities: [{ email, status: identity }], prescriptions: [{ label: "Elliot", status }] });

  it("is needed when an existing clinician.a will sign a new or draft prescription", () => {
    expect(needsExistingClinicianSignIn(withRx("new", "present"), email)).toBe(true);
    expect(needsExistingClinicianSignIn(withRx("draft", "present"), email)).toBe(true);
  });

  it("is not needed when the seed creates clinician.a or has nothing to sign", () => {
    expect(needsExistingClinicianSignIn(withRx("new", "new"), email)).toBe(false);
    expect(needsExistingClinicianSignIn(withRx("signed", "present"), email)).toBe(false);
    expect(needsExistingClinicianSignIn(withRx("duplicate", "present"), email)).toBe(false);
  });
});

describe("seeded patient visibility for existing accounts", () => {
  it("a clinician outside the seeded teams sees none of them", () => {
    expect(seededPatientVisibility({ email: "me@example.test", role: "clinician", isActive: true, teams: [] })).toMatch(/^none/);
  });

  it("a clinician on a seeded team sees that team's patients", () => {
    expect(
      seededPatientVisibility({ email: "me@example.test", role: "clinician", isActive: true, teams: [{ id: TEAMS.north, name: "Team Kestrel North (synthetic)" }] }),
    ).toMatch(/Team Kestrel North/);
  });

  it("an admin sees the list but not the charts", () => {
    expect(seededPatientVisibility({ email: "me@example.test", role: "admin", isActive: true, teams: [] })).toMatch(/list only/);
  });

  it("an inactive account sees nothing", () => {
    expect(seededPatientVisibility({ email: "me@example.test", role: "clinician", isActive: false, teams: [] })).toMatch(/^nothing/);
  });
});
