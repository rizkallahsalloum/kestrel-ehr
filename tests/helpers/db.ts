import pg from "pg";
import { expect } from "vitest";
import { IDENTITIES, type IdentityKey } from "../../scripts/fixtures.ts";
import { loadTestEnv } from "../../scripts/test-env.ts";

let pool: pg.Pool | undefined;

export function getPool(): pg.Pool {
  if (!pool) {
    pool = new pg.Pool({ connectionString: loadTestEnv().dbUrl, max: 2 });
  }
  return pool;
}

export async function closePool(): Promise<void> {
  await pool?.end();
  pool = undefined;
}

export type Actor = IdentityKey | "anon" | "postgres";

export type Tx = {
  query<R extends pg.QueryResultRow = pg.QueryResultRow>(sql: string, params?: unknown[]): Promise<pg.QueryResult<R>>;
  /** Switches the transaction to the given identity, as PostgREST would. */
  as(actor: Actor): Promise<void>;
  /** Runs a statement that must fail with the given SQLSTATE, without aborting the transaction. */
  expectError(sql: string, params: unknown[], sqlstate: string): Promise<pg.DatabaseError>;
};

/** Runs `fn` inside a transaction that is always rolled back. */
export async function withTx(fn: (tx: Tx) => Promise<void>): Promise<void> {
  const client = await getPool().connect();
  let savepoint = 0;
  const tx: Tx = {
    query: (sql, params) => client.query(sql, params as unknown[]),
    async as(actor) {
      if (actor === "postgres") {
        await client.query("set local role postgres");
        await client.query("select set_config('request.jwt.claims', '', true)");
        return;
      }
      if (actor === "anon") {
        await client.query("set local role anon");
        await client.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ role: "anon" })]);
        return;
      }
      const identity = IDENTITIES[actor];
      await client.query("set local role authenticated");
      await client.query("select set_config('request.jwt.claims', $1, true)", [
        JSON.stringify({ sub: identity.id, role: "authenticated", aud: "authenticated", email: identity.email }),
      ]);
    },
    async expectError(sql, params, sqlstate) {
      const name = `sp_${++savepoint}`;
      await client.query(`savepoint ${name}`);
      try {
        await client.query(sql, params);
      } catch (error) {
        await client.query(`rollback to savepoint ${name}`);
        expect(error).toBeInstanceOf(pg.DatabaseError);
        expect((error as pg.DatabaseError).code, (error as Error).message).toBe(sqlstate);
        return error as pg.DatabaseError;
      }
      await client.query(`rollback to savepoint ${name}`);
      throw new Error(`Expected SQLSTATE ${sqlstate} but the statement succeeded: ${sql}`);
    },
  };

  await client.query("begin");
  try {
    await fn(tx);
  } finally {
    await client.query("rollback");
    client.release();
  }
}
