import { afterAll, describe, expect, it } from "vitest";
import { IDENTITIES, PATIENTS, TEAMS } from "../../scripts/fixtures.ts";
import { closePool, withTx, type Tx } from "../helpers/db";

afterAll(closePool);

const PERMISSION_DENIED = "42501";

async function ids(tx: Tx, sql: string, params: unknown[] = []): Promise<string[]> {
  const result = await tx.query<{ id: string }>(sql, params);
  return result.rows.map((row) => row.id).sort();
}

async function auditCount(tx: Tx, action: string, entityId: string): Promise<number> {
  await tx.as("postgres");
  const result = await tx.query<{ count: string }>(
    "select count(*) from private.audit_logs where action = $1 and entity_id = $2 and occurred_at = now()",
    [action, entityId],
  );
  return Number(result.rows[0]?.count ?? 0);
}

describe("schema hardening", () => {
  it("enables RLS on every public table", async () => {
    await withTx(async (tx) => {
      const result = await tx.query<{ relname: string }>(
        "select relname from pg_class where relnamespace = 'public'::regnamespace and relkind = 'r' and not relrowsecurity",
      );
      expect(result.rows).toEqual([]);
    });
  });

  it("grants nothing to anon on public tables", async () => {
    await withTx(async (tx) => {
      const result = await tx.query(
        "select table_name, privilege_type from information_schema.role_table_grants where grantee = 'anon' and table_schema = 'public'",
      );
      expect(result.rows).toEqual([]);
    });
  });

  it("grants nothing to service_role in public or private", async () => {
    await withTx(async (tx) => {
      const result = await tx.query(
        `select n.nspname, c.relname as name, a.privilege_type
         from pg_class c
         join pg_namespace n on n.oid = c.relnamespace
         cross join lateral aclexplode(c.relacl) a
         where n.nspname in ('public', 'private') and a.grantee = 'service_role'::regrole
         union all
         select n.nspname, p.proname, a.privilege_type
         from pg_proc p
         join pg_namespace n on n.oid = p.pronamespace
         cross join lateral aclexplode(p.proacl) a
         where n.nspname in ('public', 'private') and a.grantee = 'service_role'::regrole
         union all
         select n.nspname, d.defaclobjtype::text, a.privilege_type
         from pg_default_acl d
         join pg_namespace n on n.oid = d.defaclnamespace
         cross join lateral aclexplode(d.defaclacl) a
         where n.nspname in ('public', 'private') and d.defaclrole = current_user::regrole
           and a.grantee = 'service_role'::regrole`,
      );
      expect(result.rows).toEqual([]);
    });
  });

  it("grants no write privileges to authenticated on read-only tables", async () => {
    await withTx(async (tx) => {
      const result = await tx.query(
        `select table_name, privilege_type from information_schema.role_table_grants
         where grantee = 'authenticated' and table_schema = 'public'
           and privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE')
           and table_name in ('profiles', 'care_teams', 'care_team_members', 'patients')`,
      );
      expect(result.rows).toEqual([]);
    });
  });
});

describe("profiles", () => {
  it("lets a clinician read their own and teammates' profiles only", async () => {
    await withTx(async (tx) => {
      await tx.as("clinicianA");
      const visible = await ids(tx, "select id from public.profiles");
      expect(visible).toContain(IDENTITIES.clinicianA.id);
      expect(visible).toContain(IDENTITIES.clinicianA2.id);
      expect(visible).not.toContain(IDENTITIES.clinicianB.id);
      expect(visible).not.toContain(IDENTITIES.admin.id);
    });
  });

  it("lets an admin read all profiles", async () => {
    await withTx(async (tx) => {
      await tx.as("admin");
      const visible = await ids(tx, "select id from public.profiles");
      expect(visible).toEqual(expect.arrayContaining(Object.values(IDENTITIES).map((i) => i.id)));
    });
  });

  it("prevents users from changing their own role or creating profiles", async () => {
    await withTx(async (tx) => {
      await tx.as("clinicianA");
      await tx.expectError("update public.profiles set role = 'admin' where id = $1", [IDENTITIES.clinicianA.id], PERMISSION_DENIED);
      await tx.expectError(
        "insert into public.profiles (id, full_name) values ($1, 'x')",
        [IDENTITIES.clinicianB.id],
        PERMISSION_DENIED,
      );
      await tx.expectError("delete from public.profiles where id = $1", [IDENTITIES.clinicianA.id], PERMISSION_DENIED);
    });
  });
});

describe("care teams", () => {
  it("scopes team visibility to membership", async () => {
    await withTx(async (tx) => {
      await tx.as("clinicianA");
      expect(await ids(tx, "select id from public.care_teams")).toEqual([TEAMS.north]);
      await tx.as("clinicianB");
      expect(await ids(tx, "select id from public.care_teams")).toEqual([TEAMS.south]);
      await tx.as("admin");
      expect(await ids(tx, "select id from public.care_teams")).toEqual([TEAMS.north, TEAMS.south].sort());
    });
  });

  it("blocks clinicians from adding themselves to another team", async () => {
    await withTx(async (tx) => {
      await tx.as("clinicianA");
      await tx.expectError(
        "insert into public.care_team_members (care_team_id, profile_id) values ($1, $2)",
        [TEAMS.south, IDENTITIES.clinicianA.id],
        PERMISSION_DENIED,
      );
      await tx.expectError(
        "select public.admin_set_team_membership($1, $2, true)",
        [TEAMS.south, IDENTITIES.clinicianA.id],
        PERMISSION_DENIED,
      );
    });
  });

  it("lets an admin manage membership, with an audit row", async () => {
    await withTx(async (tx) => {
      await tx.as("admin");
      await tx.query("select public.admin_set_team_membership($1, $2, true)", [TEAMS.north, IDENTITIES.clinicianB.id]);
      expect(await auditCount(tx, "care_team.member_added", TEAMS.north)).toBe(1);
      await tx.as("clinicianB");
      expect(await ids(tx, "select id from public.patients")).toContain(PATIENTS.northOne);
    });
  });

  it("refuses to make an admin a care team member", async () => {
    await withTx(async (tx) => {
      await tx.as("admin");
      await tx.expectError(
        "select public.admin_set_team_membership($1, $2, true)",
        [TEAMS.north, IDENTITIES.admin.id],
        "23514",
      );
    });
  });
});

describe("patients", () => {
  it("shows a clinician only their team's patients", async () => {
    await withTx(async (tx) => {
      await tx.as("clinicianA");
      expect(await ids(tx, "select id from public.patients")).toEqual(
        [PATIENTS.northOne, PATIENTS.northTwo, PATIENTS.northThree].sort(),
      );
      expect(await ids(tx, "select id from public.patients where id = $1", [PATIENTS.southOne])).toEqual([]);
    });
  });

  it("denies inactive clinicians even when they are still team members", async () => {
    await withTx(async (tx) => {
      await tx.as("inactive");
      expect(await ids(tx, "select id from public.patients")).toEqual([]);
      expect(await ids(tx, "select id from public.care_teams")).toEqual([]);
    });
  });

  it("denies anonymous access outright", async () => {
    await withTx(async (tx) => {
      await tx.as("anon");
      await tx.expectError("select id from public.patients", [], PERMISSION_DENIED);
      await tx.expectError("select id from public.profiles", [], PERMISSION_DENIED);
    });
  });

  it("prevents clinicians from reassigning, editing or deleting patients", async () => {
    await withTx(async (tx) => {
      await tx.as("clinicianB");
      await tx.expectError(
        "update public.patients set care_team_id = $1 where id = $2",
        [TEAMS.south, PATIENTS.northOne],
        PERMISSION_DENIED,
      );
      await tx.expectError("delete from public.patients where id = $1", [PATIENTS.northOne], PERMISSION_DENIED);
      await tx.expectError(
        "select public.admin_assign_patient_team($1, $2)",
        [PATIENTS.northOne, TEAMS.south],
        PERMISSION_DENIED,
      );
    });
  });

  it("lets an admin reassign a patient, with an audit row attributed to the admin", async () => {
    await withTx(async (tx) => {
      await tx.as("admin");
      await tx.query("select public.admin_assign_patient_team($1, $2)", [PATIENTS.northThree, TEAMS.south]);
      await tx.as("postgres");
      const audit = await tx.query<{ actor_id: string; actor_role: string }>(
        "select actor_id, actor_role from private.audit_logs where action = 'patient.team_assigned' and entity_id = $1 and occurred_at = now()",
        [PATIENTS.northThree],
      );
      expect(audit.rows).toEqual([{ actor_id: IDENTITIES.admin.id, actor_role: "admin" }]);
    });
  });
});

describe("audit log", () => {
  it("is not readable or writable directly by application users", async () => {
    await withTx(async (tx) => {
      for (const actor of ["clinicianA", "admin"] as const) {
        await tx.as(actor);
        await tx.expectError("select * from private.audit_logs", [], PERMISSION_DENIED);
        await tx.expectError(
          "select private.write_audit('patient_chart.viewed', 'patient', $1, $1, '{}')",
          [PATIENTS.northOne],
          PERMISSION_DENIED,
        );
      }
    });
  });

  it("can be read by admins only through admin_list_audit_events", async () => {
    await withTx(async (tx) => {
      await tx.as("admin");
      await tx.query("select * from public.admin_list_audit_events(10, null)");
      await tx.as("clinicianA");
      await tx.expectError("select * from public.admin_list_audit_events(10, null)", [], PERMISSION_DENIED);
    });
  });

  it("rejects updates and deletes even from the table owner", async () => {
    await withTx(async (tx) => {
      await tx.as("clinicianA");
      await tx.query("select public.log_patient_access($1)", [PATIENTS.northOne]);
      await tx.as("postgres");
      await tx.expectError("update private.audit_logs set action = 'prescription.signed'", [], PERMISSION_DENIED);
      await tx.expectError("delete from private.audit_logs", [], PERMISSION_DENIED);
      await tx.expectError("truncate private.audit_logs", [], PERMISSION_DENIED);
    });
  });

  it("logs chart views only for care-team members", async () => {
    await withTx(async (tx) => {
      await tx.as("clinicianA");
      await tx.query("select public.log_patient_access($1)", [PATIENTS.northOne]);
      await tx.expectError("select public.log_patient_access($1)", [PATIENTS.southOne], PERMISSION_DENIED);
      expect(await auditCount(tx, "patient_chart.viewed", PATIENTS.northOne)).toBe(1);
      expect(await auditCount(tx, "patient_chart.viewed", PATIENTS.southOne)).toBe(0);
    });
  });
});
