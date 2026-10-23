import pg from "pg";
import { loadTestEnv } from "../../scripts/test-env.ts";

/** The URL reference pattern (see src/features/patients/refs.ts), for URL assertions. */
export const REF = "[0-9a-hjkmnp-tv-z]{10}";

let cache: Map<string, string> | undefined;

/**
 * The opaque URL reference of a seeded patient on kestrel-test. References are random and assigned
 * by the database, so tests read them (read-only) instead of hard-coding them.
 */
export async function patientRef(patientId: string): Promise<string> {
  if (!cache) {
    const client = new pg.Client({ connectionString: loadTestEnv().dbUrl });
    await client.connect();
    try {
      const { rows } = await client.query<{ id: string; public_ref: string }>("select id, public_ref from public.patients");
      cache = new Map(rows.map((row) => [row.id, row.public_ref]));
    } finally {
      await client.end();
    }
  }
  const ref = cache.get(patientId);
  if (!ref) throw new Error(`No seeded patient ${patientId}`);
  return ref;
}
