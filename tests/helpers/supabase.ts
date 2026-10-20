import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { IDENTITIES, type IdentityKey } from "../../scripts/fixtures.ts";
import { loadTestEnv } from "../../scripts/test-env.ts";
import type { Database } from "@/types/database";

export type TypedClient = SupabaseClient<Database>;

const cache = new Map<IdentityKey | "anon", TypedClient>();

function newClient(): TypedClient {
  const env = loadTestEnv();
  return createClient<Database>(env.supabaseUrl, env.publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** A client using only the publishable key, as an unauthenticated browser would. */
export function anonClient(): TypedClient {
  let client = cache.get("anon");
  if (!client) {
    client = newClient();
    cache.set("anon", client);
  }
  return client;
}

/** A client signed in as a seeded synthetic identity through Supabase Auth. */
export async function clientFor(key: IdentityKey): Promise<TypedClient> {
  const existing = cache.get(key);
  if (existing) return existing;
  const client = newClient();
  const { error } = await client.auth.signInWithPassword({
    email: IDENTITIES[key].email,
    password: loadTestEnv().testUserPassword,
  });
  if (error) throw new Error(`Sign-in failed for ${key}: ${error.message}`);
  cache.set(key, client);
  return client;
}
