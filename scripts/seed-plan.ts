import { IDENTITIES, TEAMS } from "./fixtures.ts";

export type SqlValue = string | number | boolean | null;

export type SeedInsert = {
  table: string;
  columns: string[];
  rows: SqlValue[][];
};

/**
 * Natural key of every table `supabase/seed/synthetic.sql` inserts into. A row with this key
 * already on the target counts as seeded (if its values match) or conflicting (if they differ);
 * any other row in the table was not created by the seed.
 */
export const TABLE_KEYS: Record<string, readonly string[]> = {
  care_teams: ["id"],
  care_team_members: ["care_team_id", "profile_id"],
  patients: ["id"],
  drug_classes: ["code"],
  medications: ["id"],
  interaction_rules: ["rule_code"],
  allergies: ["id"],
  patient_medications: ["id"],
  diagnoses: ["id"],
  vital_readings: ["patient_id", "recorded_at"],
  lab_results: ["patient_id", "test", "collected_on"],
};

export class SeedSqlError extends Error {}

/** Splits SQL into statements on semicolons outside string literals, dropping `--` comments. */
function statements(sql: string): string[] {
  const out: string[] = [];
  let current = "";
  let inString = false;
  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i]!;
    if (inString) {
      current += ch;
      if (ch === "'") {
        if (sql[i + 1] === "'") {
          current += "'";
          i++;
        } else {
          inString = false;
        }
      }
      continue;
    }
    if (ch === "-" && sql[i + 1] === "-") {
      while (i < sql.length && sql[i] !== "\n") i++;
      current += "\n";
      continue;
    }
    if (ch === "'") inString = true;
    if (ch === ";") {
      if (current.trim()) out.push(current.trim());
      current = "";
      continue;
    }
    current += ch;
  }
  if (current.trim()) out.push(current.trim());
  return out;
}

function parseTuples(body: string, table: string): SqlValue[][] {
  const rows: SqlValue[][] = [];
  let i = 0;
  const skipSpace = () => {
    while (i < body.length && /\s/.test(body[i]!)) i++;
  };
  for (;;) {
    skipSpace();
    if (body[i] !== "(") break;
    i++;
    const row: SqlValue[] = [];
    for (;;) {
      skipSpace();
      if (body[i] === "'") {
        let value = "";
        i++;
        for (;;) {
          if (i >= body.length) throw new SeedSqlError(`Unterminated string in ${table}.`);
          if (body[i] === "'") {
            if (body[i + 1] === "'") {
              value += "'";
              i += 2;
              continue;
            }
            i++;
            break;
          }
          value += body[i];
          i++;
        }
        row.push(value);
      } else {
        const match = /^(null|true|false|-?\d+(?:\.\d+)?)/i.exec(body.slice(i));
        if (!match) throw new SeedSqlError(`Unsupported value in ${table} near "${body.slice(i, i + 20)}".`);
        const token = match[1]!.toLowerCase();
        row.push(token === "null" ? null : token === "true" ? true : token === "false" ? false : Number(token));
        i += match[1]!.length;
      }
      skipSpace();
      if (body[i] === ",") {
        i++;
        continue;
      }
      if (body[i] === ")") {
        i++;
        break;
      }
      throw new SeedSqlError(`Expected "," or ")" in ${table}.`);
    }
    rows.push(row);
    skipSpace();
    if (body[i] === ",") i++;
  }
  const rest = body.slice(i).trim();
  if (rest && !/^on conflict\b/i.test(rest)) {
    throw new SeedSqlError(`Unexpected text after the values of ${table}.`);
  }
  return rows;
}

/**
 * Reads the `insert ... values ... on conflict do nothing` statements of the synthetic seed SQL.
 * Other statements (the profile role updates) are returned separately; the Dev seed never runs them
 * on rows it did not create.
 */
export function parseSeedSql(sql: string): { inserts: SeedInsert[]; otherStatements: string[] } {
  const inserts: SeedInsert[] = [];
  const otherStatements: string[] = [];
  for (const statement of statements(sql)) {
    const header = /^insert into public\.(\w+)\s*\(([^)]*)\)\s*values\s*/i.exec(statement);
    if (!header) {
      otherStatements.push(statement);
      continue;
    }
    const table = header[1]!;
    const columns = header[2]!.split(",").map((column) => column.trim());
    const keys = TABLE_KEYS[table];
    if (!keys) throw new SeedSqlError(`No natural key is defined for ${table}; add it to TABLE_KEYS.`);
    if (keys.some((key) => !columns.includes(key))) {
      throw new SeedSqlError(`The ${table} insert does not include every key column.`);
    }
    const rows = parseTuples(statement.slice(header[0].length), table);
    for (const row of rows) {
      if (row.length !== columns.length) throw new SeedSqlError(`A ${table} row has ${row.length} values for ${columns.length} columns.`);
    }
    inserts.push({ table, columns, rows });
  }
  return { inserts, otherStatements };
}

export function rowKey(insert: SeedInsert, row: SqlValue[]): string {
  return TABLE_KEYS[insert.table]!.map((key) => String(row[insert.columns.indexOf(key)])).join(" / ");
}

// --- Inspection results and the decisions made from them -------------------------------------

export type RowStatus = "new" | "present" | "conflict";

export type TableReport = {
  table: string;
  missing: boolean;
  rows: { key: string; status: RowStatus }[];
  foreignCount: number;
  foreignSample: string[];
};

export type IdentityReport = { email: string; status: RowStatus; detail?: string };

export type AccountReport = {
  email: string;
  role: string | null;
  isActive: boolean | null;
  teams: { id: string; name: string }[];
};

export type PrescriptionReport = {
  label: string;
  status: "new" | "draft" | "signed" | "cancelled" | "duplicate" | "alert" | "unavailable";
  detail?: string;
};

export type SeedPrescriptionSkip = { status: "duplicate" | "alert"; detail: string };

/**
 * Tables where rows the seed did not create (prescriptions made in the app, and the medication
 * list entries signing adds) are reported but do not stop the run. The seed never touches them.
 * Rows with the seed's own key but different values still stop it.
 */
export const REPORT_ONLY_TABLES: ReadonlySet<string> = new Set(["prescriptions", "patient_medications"]);

export type DevReport = {
  migrationHistoryFound: boolean;
  pendingMigrations: string[];
  missingTables: string[];
  tables: TableReport[];
  identities: IdentityReport[];
  otherAccounts: AccountReport[];
  prescriptions: PrescriptionReport[];
};

/**
 * What happens to one seed prescription. `existing` is the status of the seed's own prescription
 * (by idempotency key), if any; `skip` is a duplicate signed prescription of the same medication or
 * a predicted DEMO alert. A skip never leads to a new or newly signed prescription.
 */
export function planSeedPrescription(
  label: string,
  existing: string | undefined,
  skip: SeedPrescriptionSkip | undefined,
): PrescriptionReport {
  const status = (existing ?? "new") as PrescriptionReport["status"];
  if (skip && (status === "new" || status === "draft")) return { label, status: skip.status, detail: skip.detail };
  return { label, status };
}

/** Reasons the real run must stop. Empty means it may insert. */
export function devSeedBlockers(report: DevReport): string[] {
  const blockers: string[] = [];
  if (!report.migrationHistoryFound) {
    blockers.push("The migration history table (supabase_migrations.schema_migrations) was not found on Dev.");
  }
  if (report.pendingMigrations.length > 0) {
    blockers.push(
      `Dev is missing migrations ${report.pendingMigrations.join(", ")}. Apply them first; this seed never changes the schema.`,
    );
  }
  if (report.missingTables.length > 0) {
    blockers.push(`Dev has no table ${report.missingTables.map((t) => `public.${t}`).join(", ")}.`);
  }
  for (const table of report.tables) {
    const conflicts = table.rows.filter((row) => row.status === "conflict").length;
    if (conflicts > 0) {
      blockers.push(`${conflicts} row(s) in public.${table.table} have the seed's key but different values.`);
    }
    if (table.foreignCount > 0 && !REPORT_ONLY_TABLES.has(table.table)) {
      blockers.push(`public.${table.table} holds ${table.foreignCount} row(s) the seed did not create.`);
    }
  }
  for (const identity of report.identities) {
    if (identity.status === "conflict") blockers.push(`Auth user ${identity.email}: ${identity.detail ?? "conflict"}.`);
  }
  return blockers;
}

const SEED_TEAM_IDS = new Set<string>(Object.values(TEAMS));

/** What an existing (non-seed) Dev account would see of the seeded patients under RLS. */
export function seededPatientVisibility(account: AccountReport): string {
  if (!account.isActive || !account.role) {
    return "nothing: the account is inactive or has no profile, so RLS returns no patients.";
  }
  const seedTeams = account.teams.filter((team) => SEED_TEAM_IDS.has(team.id));
  if (account.role === "clinician") {
    if (seedTeams.length === 0) {
      return "none of them: it is not a member of either seeded care team, and RLS limits clinicians to their teams' patients.";
    }
    return `the patients of ${seedTeams.map((team) => team.name).join(" and ")} (team member).`;
  }
  if (account.role === "admin") {
    return "the patient list only (admins read patients through patients_select_admin), but not their charts: charts need care-team membership, and admins cannot be members.";
  }
  return "none of them.";
}

export const SEED_LOGINS = [
  { email: IDENTITIES.clinicianA.email, sees: "Team Kestrel North (synthetic): Rowan Testcase, Elliot Samplewood, Morgan Fixture" },
  { email: IDENTITIES.clinicianB.email, sees: "Team Kestrel South (synthetic): Jordan Mockridge, Casey Placeholder" },
] as const;
