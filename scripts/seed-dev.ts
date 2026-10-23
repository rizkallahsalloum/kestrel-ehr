import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import pg from "pg";
import { DevSeedEnvError, loadDevSeedEnv, parseDevSeedArgs, readTestProjectRef, type DevSeedEnv } from "./dev-seed-env.ts";
import { IDENTITIES, SEED_DRAFTS, SEED_SIGNED } from "./fixtures.ts";
import {
  devSeedBlockers,
  parseSeedSql,
  planSeedPrescription,
  REPORT_ONLY_TABLES,
  rowKey,
  SEED_LOGINS,
  seededPatientVisibility,
  TABLE_KEYS,
  type AccountReport,
  type DevReport,
  type IdentityReport,
  type PrescriptionReport,
  type SeedInsert,
  type SeedPrescriptionSkip,
  type SqlValue,
  type TableReport,
} from "./seed-plan.ts";
import { seedSignedPrescriptions, SIGNED_PLANS } from "./seed-prescriptions.ts";

/*
 * Insert-only synthetic seed for Kestrel-Dev.
 *   pnpm db:seed:dev:dry                                    read-only report, writes nothing
 *   pnpm db:seed:dev -- --confirm-dev lcpopxpoctphdodxzitx  inserts what the dry run listed
 * Never deletes, never updates rows it did not create, never changes the schema or existing users.
 */

let env: DevSeedEnv;
let mode;
try {
  mode = parseDevSeedArgs(process.argv.slice(2));
  env = loadDevSeedEnv();
} catch (error) {
  if (error instanceof DevSeedEnvError) {
    console.error(`Refusing to run: ${error.message}`);
    process.exit(1);
  }
  throw error;
}

const { inserts } = parseSeedSql(readFileSync(resolve("supabase/seed/synthetic.sql"), "utf8"));
const SEED_RX_KEYS = [...Object.values(SEED_SIGNED), ...Object.values(SEED_DRAFTS)];
/** Tables the seed does not insert into but checks for rows it did not create. */
const CHECKED_ONLY = ["prescriptions", "encounter_notes"] as const;

const PATIENT_LABEL =
  "coalesce((select p.mrn from public.patients p where p.id = t.patient_id), t.patient_id::text)";
const MEDICATION_LABEL =
  "coalesce((select m.name from public.medications m where m.id = t.medication_id), t.medication_id::text)";
const FOREIGN_LABELS: Record<string, string> = {
  care_teams: "t.name",
  care_team_members:
    "coalesce((select c.name from public.care_teams c where c.id = t.care_team_id), t.care_team_id::text) || ' / ' || coalesce((select u.email from auth.users u where u.id = t.profile_id), t.profile_id::text)",
  patients: "t.mrn || ' ' || t.given_name || ' ' || t.family_name",
  drug_classes: "t.code",
  medications: "t.name || ' (' || coalesce(t.drug_class_code, 'no class') || ')'",
  interaction_rules: "t.rule_code",
  prescriptions: `'prescription ' || t.id::text || ' ' || ${MEDICATION_LABEL} || ' (' || t.status::text || ') for ' || ${PATIENT_LABEL}`,
  patient_medications: `'medication list entry ' || t.id::text || ' ' || ${MEDICATION_LABEL} || ' (' || t.status::text || case when t.source_prescription_id is null then '' else ', from a prescription' end || ') for ' || ${PATIENT_LABEL}`,
};

function foreignLabel(table: string): string {
  return FOREIGN_LABELS[table] ?? `'row ' || t.id::text || ' for ' || ${PATIENT_LABEL}`;
}

/** Rows the seed owns beyond its fixture keys: the prescriptions it signs and what signing creates. */
function extraOwned(table: string, params: unknown[]): string | null {
  if (table === "prescriptions") {
    params.push(IDENTITIES.clinicianA.id, SEED_RX_KEYS);
    return `(t.prescriber_id = $${params.length - 1} and t.idempotency_key = any ($${params.length}::uuid[]))`;
  }
  if (table === "patient_medications") {
    params.push(IDENTITIES.clinicianA.id, SEED_RX_KEYS);
    return `t.source_prescription_id in (select r.id from public.prescriptions r where r.prescriber_id = $${params.length - 1} and r.idempotency_key = any ($${params.length}::uuid[]))`;
  }
  return null;
}

async function foreignRows(client: pg.Client, table: string, insert: SeedInsert | undefined): Promise<Pick<TableReport, "foreignCount" | "foreignSample">> {
  const params: unknown[] = [];
  const owned: string[] = [];
  if (insert) {
    const keys = TABLE_KEYS[table]!;
    for (const row of insert.rows) {
      owned.push(
        `(${keys
          .map((key) => {
            params.push(row[insert.columns.indexOf(key)]);
            return `t.${key} = $${params.length}`;
          })
          .join(" and ")})`,
      );
    }
  }
  const extra = extraOwned(table, params);
  if (extra) owned.push(extra);
  const where = owned.length > 0 ? `where not (${owned.join(" or ")})` : "";
  const count = await client.query<{ n: string }>(`select count(*)::text as n from public.${table} t ${where}`, params);
  const sample = await client.query<{ label: string }>(
    `select ${foreignLabel(table)} as label from public.${table} t ${where} order by 1 limit 20`,
    params,
  );
  return { foreignCount: Number(count.rows[0]!.n), foreignSample: sample.rows.map((row) => row.label) };
}

async function inspectTable(client: pg.Client, insert: SeedInsert): Promise<TableReport> {
  const keys = TABLE_KEYS[insert.table]!;
  const keyWhere = keys.map((key) => `${key} = $${insert.columns.indexOf(key) + 1}`).join(" and ");
  const same = insert.columns.map((column, i) => `${column} is not distinct from $${i + 1}`).join(" and ");
  const rows: TableReport["rows"] = [];
  for (const row of insert.rows) {
    const found = await client.query<{ same: boolean }>(`select (${same}) as same from public.${insert.table} where ${keyWhere}`, row);
    rows.push({
      key: rowKey(insert, row),
      status: found.rows.length === 0 ? "new" : found.rows[0]!.same ? "present" : "conflict",
    });
  }
  return { table: insert.table, missing: false, rows, ...(await foreignRows(client, insert.table, insert)) };
}

/** Same matching as private.compute_prescription_alerts, for a prescription not yet created. */
const PREDICTED_ALERTS = `
  select r.rule_code, r.severity::text as severity
    from public.medications m
    join public.interaction_rules r
      on r.is_active and r.rule_type = 'allergy_class' and r.class_a = m.drug_class_code
    join public.allergies a
      on a.patient_id = $1 and a.status = 'active' and a.drug_class_code = r.class_a
   where m.id = $2
  union
  select r.rule_code, r.severity::text
    from public.medications m
    join public.interaction_rules r
      on r.is_active and r.rule_type = 'interaction_class' and m.drug_class_code in (r.class_a, r.class_b)
    join public.patient_medications pm
      on pm.patient_id = $1 and pm.status = 'active'
    join public.medications pmm
      on pmm.id = pm.medication_id
     and pmm.drug_class_code = case when m.drug_class_code = r.class_a then r.class_b else r.class_a end
   where m.id = $2
  order by 1`;

/**
 * Seed prescriptions to skip. A patient who already has a signed prescription of the same
 * medication (not made by the seed) keeps it as the Renew source, so no duplicate therapy is
 * created. A prescription that would raise any DEMO alert is skipped too: signing needs the alert
 * acknowledged, and the seed does not acknowledge alerts on anyone's behalf.
 */
async function prescriptionSkips(client: pg.Client): Promise<Map<string, SeedPrescriptionSkip>> {
  const skip = new Map<string, SeedPrescriptionSkip>();
  for (const plan of SIGNED_PLANS) {
    const found = await client.query<{ n: string }>(
      `select count(*)::text as n from public.prescriptions
        where patient_id = $1 and medication_id = $2 and status = 'signed'
          and not (prescriber_id = $3 and idempotency_key = $4)`,
      [plan.patientId, plan.medicationId, IDENTITIES.clinicianA.id, plan.key],
    );
    const count = Number(found.rows[0]!.n);
    if (count > 0) {
      skip.set(plan.key, {
        status: "duplicate",
        detail: `the patient already has ${count} signed prescription(s) of the same medication, which stay as Renew sources.`,
      });
      continue;
    }
    const alerts = await client.query<{ rule_code: string; severity: string }>(PREDICTED_ALERTS, [plan.patientId, plan.medicationId]);
    if (alerts.rows.length > 0) {
      skip.set(plan.key, {
        status: "alert",
        detail: `it would raise ${alerts.rows.map((a) => `${a.rule_code} (${a.severity})`).join(", ")} against the patient's current records, and the seed does not acknowledge alerts.`,
      });
    }
  }
  return skip;
}

async function inspect(client: pg.Client): Promise<DevReport> {
  await client.query("set local time zone 'UTC'");

  const local = readdirSync(resolve("supabase/migrations"))
    .filter((file) => file.endsWith(".sql"))
    .sort();
  const history = await client.query<{ present: boolean }>(
    "select to_regclass('supabase_migrations.schema_migrations') is not null as present",
  );
  const migrationHistoryFound = history.rows[0]!.present;
  let applied = new Set<string>();
  if (migrationHistoryFound) {
    const versions = await client.query<{ version: string }>("select version::text from supabase_migrations.schema_migrations");
    applied = new Set(versions.rows.map((row) => row.version));
  }
  const pendingMigrations = local.filter((file) => !applied.has(file.split("_")[0]!));

  const allTables = [...inserts.map((insert) => insert.table), ...CHECKED_ONLY];
  const existing = await client.query<{ table: string }>(
    "select t as table from unnest($1::text[]) t where to_regclass('public.' || t) is not null",
    [allTables],
  );
  const present = new Set(existing.rows.map((row) => row.table));
  const missingTables = allTables.filter((table) => !present.has(table));

  const tables: TableReport[] = [];
  for (const insert of inserts) {
    tables.push(
      present.has(insert.table)
        ? await inspectTable(client, insert)
        : { table: insert.table, missing: true, rows: insert.rows.map((row) => ({ key: rowKey(insert, row), status: "new" as const })), foreignCount: 0, foreignSample: [] },
    );
  }
  for (const table of CHECKED_ONLY) {
    if (present.has(table)) tables.push({ table, missing: false, rows: [], ...(await foreignRows(client, table, undefined)) });
  }

  const fixtures = Object.values(IDENTITIES);
  const users = await client.query<{ id: string; email: string | null }>(
    "select id::text, lower(email) as email from auth.users where id = any ($1::uuid[]) or lower(email) = any ($2::text[])",
    [fixtures.map((identity) => identity.id), fixtures.map((identity) => identity.email.toLowerCase())],
  );
  const identities: IdentityReport[] = fixtures.map((identity) => {
    const byId = users.rows.find((user) => user.id === identity.id);
    const byEmail = users.rows.find((user) => user.email === identity.email.toLowerCase());
    if (!byId && !byEmail) return { email: identity.email, status: "new" };
    if (byId && byId.email === identity.email.toLowerCase()) return { email: identity.email, status: "present" };
    return {
      email: identity.email,
      status: "conflict",
      detail: byId ? "the seed's user id belongs to a different email" : "the email belongs to a user the seed did not create",
    };
  });

  const accounts = await client.query<{ id: string; email: string | null; role: string | null; is_active: boolean | null }>(
    `select u.id::text, u.email, p.role::text, p.is_active
       from auth.users u left join public.profiles p on p.id = u.id
      where not (u.id = any ($1::uuid[]))
      order by u.created_at`,
    [fixtures.map((identity) => identity.id)],
  );
  const memberships = await client.query<{ profile_id: string; id: string; name: string }>(
    "select m.profile_id::text, c.id::text, c.name from public.care_team_members m join public.care_teams c on c.id = m.care_team_id",
  );
  const otherAccounts: AccountReport[] = accounts.rows.map((account) => ({
    email: account.email ?? `(no email, id ${account.id})`,
    role: account.role,
    isActive: account.is_active,
    teams: memberships.rows.filter((m) => m.profile_id === account.id).map((m) => ({ id: m.id, name: m.name })),
  }));

  let prescriptions: PrescriptionReport[];
  if (present.has("prescriptions")) {
    const found = await client.query<{ key: string; status: string }>(
      "select idempotency_key::text as key, status::text from public.prescriptions where prescriber_id = $1 and idempotency_key = any ($2::uuid[])",
      [IDENTITIES.clinicianA.id, SIGNED_PLANS.map((plan) => plan.key)],
    );
    const skips = await prescriptionSkips(client);
    prescriptions = SIGNED_PLANS.map((plan) =>
      planSeedPrescription(plan.label, found.rows.find((row) => row.key === plan.key)?.status, skips.get(plan.key)),
    );
  } else {
    prescriptions = SIGNED_PLANS.map((plan) => ({ label: plan.label, status: "unavailable" }));
  }

  return { migrationHistoryFound, pendingMigrations, missingTables, tables, identities, otherAccounts, prescriptions };
}

function printReport(report: DevReport): void {
  console.log("\n== Schema");
  console.log(
    report.pendingMigrations.length === 0
      ? "All local migrations are applied on Dev."
      : `Not applied on Dev: ${report.pendingMigrations.join(", ")}`,
  );
  if (report.missingTables.length > 0) console.log(`Missing tables: ${report.missingTables.join(", ")}`);

  console.log("\n== Seed accounts (created only if missing; existing ones are never changed)");
  for (const identity of report.identities) {
    const text = { new: "would be created", present: "already exists, left unchanged", conflict: `CONFLICT: ${identity.detail}` }[identity.status];
    console.log(`  ${identity.email}: ${text}`);
  }

  console.log("\n== Rows");
  for (const table of report.tables) {
    const count = (status: string) => table.rows.filter((row) => row.status === status).length;
    const reportOnly = REPORT_ONLY_TABLES.has(table.table);
    const foreign = `${table.foreignCount} not created by the seed${reportOnly ? " (reported only; left unchanged)" : ""}`;
    const head = table.missing
      ? `public.${table.table}: TABLE MISSING (${table.rows.length} seed rows cannot be inserted)`
      : table.rows.length > 0
        ? `public.${table.table}: ${count("new")} to insert, ${count("present")} already present, ${count("conflict")} conflicting, ${foreign}`
        : `public.${table.table}: the seed inserts none here directly; ${foreign}`;
    console.log(head);
    if (table.missing) continue;
    for (const row of table.rows.filter((row) => row.status !== "present")) {
      console.log(`    ${row.status === "new" ? "insert" : "CONFLICT"} ${row.key}`);
    }
    for (const label of table.foreignSample) console.log(`    ${reportOnly ? "existing, kept" : "not seeded"}: ${label}`);
    if (table.foreignCount > table.foreignSample.length) console.log(`    ... and ${table.foreignCount - table.foreignSample.length} more`);
  }

  console.log("\n== Signed DEMO prescriptions (made as clinician.a through the app's RPCs, RLS applies)");
  for (const rx of report.prescriptions) {
    const text = {
      new: "would be created, safety-checked and signed",
      draft: "exists as a draft; would be safety-checked and signed",
      signed: "already signed, left unchanged",
      cancelled: "cancelled, left unchanged",
      duplicate: `would be SKIPPED: ${rx.detail}`,
      alert: `would be SKIPPED (no draft is created): ${rx.detail}`,
      unavailable: "cannot be seeded until the schema is complete",
    }[rx.status];
    console.log(`  ${rx.label}: ${text}`);
  }

  console.log("\n== Signing in to Dev and what each account sees");
  console.log("  Seeded patients belong to Team Kestrel North (synthetic) and Team Kestrel South (synthetic).");
  console.log("  Start `pnpm dev`, open /login and sign in as:");
  for (const login of SEED_LOGINS) {
    const exists = report.identities.find((identity) => identity.email === login.email)?.status === "present";
    const password = exists
      ? "its existing password (the account already exists; the seed never changes it)"
      : "KESTREL_DEV_SEED_PASSWORD from .env.dev-seed (created by the seed)";
    console.log(`    ${login.email} with ${password} -> ${login.sees}`);
  }
  if (report.identities.find((identity) => identity.email === SEED_LOGINS[0].email)?.status === "present") {
    console.log("  Signing seed prescriptions logs in as clinician.a with KESTREL_DEV_SEED_PASSWORD, so it must equal that account's");
    console.log("  current password; otherwise the rows above are still inserted and the prescription step stops with a sign-in error.");
  }
  if (report.otherAccounts.length === 0) {
    console.log("  No other Dev accounts exist.");
  }
  for (const account of report.otherAccounts) {
    const teams = account.teams.length > 0 ? account.teams.map((team) => team.name).join(", ") : "no care team";
    console.log(`  Existing account ${account.email} (${account.role ?? "no profile"}, ${account.isActive ? "active" : "inactive"}, ${teams}) would see: ${seededPatientVisibility(account)}`);
  }
  console.log("  The seed does not change existing accounts or add them to teams. To see the seeded charts as your own");
  console.log("  account, it would have to be an active clinician on one of the seeded teams; until then use clinician.a or clinician.b.");
}

async function createMissingIdentities(report: DevReport): Promise<Set<string>> {
  const admin = createClient(env.supabaseUrl, env.secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const created = new Set<string>();
  for (const identity of Object.values(IDENTITIES)) {
    if (report.identities.find((entry) => entry.email === identity.email)?.status !== "new") continue;
    const { error } = await admin.auth.admin.createUser({
      id: identity.id,
      email: identity.email,
      password: env.seedPassword,
      email_confirm: true,
      user_metadata: { full_name: identity.fullName },
    });
    if (error) throw new Error(`Could not create ${identity.email}: ${error.message}`);
    created.add(identity.id);
    console.log(`Created auth user ${identity.email}`);
  }
  return created;
}

async function insertRows(client: pg.Client, createdIdentities: Set<string>): Promise<void> {
  // Profiles come from the auth trigger as active clinicians; only profiles created in this run are adjusted.
  if (createdIdentities.has(IDENTITIES.admin.id)) {
    await client.query("update public.profiles set role = 'admin' where id = $1", [IDENTITIES.admin.id]);
  }
  if (createdIdentities.has(IDENTITIES.inactive.id)) {
    await client.query("update public.profiles set is_active = false where id = $1", [IDENTITIES.inactive.id]);
  }
  for (const insert of inserts) {
    const placeholders = insert.columns.map((_, i) => `$${i + 1}`).join(", ");
    let added = 0;
    for (const row of insert.rows) {
      const result = await client.query(
        `insert into public.${insert.table} (${insert.columns.join(", ")}) values (${placeholders}) on conflict do nothing`,
        row as SqlValue[],
      );
      added += result.rowCount ?? 0;
    }
    console.log(`public.${insert.table}: inserted ${added} of ${insert.rows.length}`);
  }
}

const client = new pg.Client({ connectionString: env.dbUrl });
await client.connect();
try {
  console.log(`Kestrel-Dev seed (${mode === "dry-run" ? "DRY RUN, read-only" : "REAL RUN"}) on project ${env.projectRef}.`);
  console.log(`Test project ref ${readTestProjectRef() ?? "(no .env.test)"} is refused by this script.`);

  await client.query("begin transaction isolation level repeatable read read only");
  const report = await inspect(client);
  await client.query("rollback");
  printReport(report);

  const blockers = devSeedBlockers(report);
  console.log("\n== Verdict");
  if (blockers.length > 0) {
    console.log("The real run would REFUSE to write anything:");
    for (const blocker of blockers) console.log(`  - ${blocker}`);
  } else {
    console.log("The real run would insert only the rows marked 'insert' above and the listed prescriptions.");
  }

  if (mode === "dry-run") {
    console.log("\nDry run: nothing was written.");
  } else if (blockers.length > 0) {
    console.error("\nRefusing to seed Kestrel-Dev. Nothing was written.");
    process.exitCode = 1;
  } else {
    const created = await createMissingIdentities(report);
    await client.query("begin");
    try {
      await client.query("lock table public.patients in share row exclusive mode");
      const recheck = devSeedBlockers(await inspect(client));
      if (recheck.length > 0) throw new Error(`Dev changed since the check: ${recheck.join(" ")}`);
      await insertRows(client, created);
      await client.query("commit");
    } catch (error) {
      await client.query("rollback");
      throw error;
    }
    const skips = await prescriptionSkips(client);
    const skip = new Map([...skips].map(([key, value]) => [key, value.detail]));
    const toSign = report.prescriptions.filter(
      (rx, i) => (rx.status === "new" || rx.status === "draft") && !skip.has(SIGNED_PLANS[i]!.key),
    );
    if (toSign.length > 0) {
      if (!created.has(IDENTITIES.clinicianA.id)) {
        console.log(`${IDENTITIES.clinicianA.email} already existed; signing in with KESTREL_DEV_SEED_PASSWORD (its password is not changed).`);
      }
      await seedSignedPrescriptions(
        { supabaseUrl: env.supabaseUrl, publishableKey: env.publishableKey, password: env.seedPassword },
        { skip },
      );
    } else {
      for (const plan of SIGNED_PLANS) {
        const reason = skip.get(plan.key);
        if (reason) console.log(`Skipped the DEMO prescription for ${plan.label}: ${reason}`);
      }
    }
    console.log("\nKestrel-Dev seed finished.");
  }
} finally {
  await client.end();
}
