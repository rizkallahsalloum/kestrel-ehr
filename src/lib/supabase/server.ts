import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/types/database";
import { assertNoPrivilegedKeys, getPublicEnv } from "@/lib/env";

/**
 * Supabase client bound to the signed-in user's session cookies. Every query
 * runs with the user's JWT, so RLS applies. Create one per request.
 */
export async function createClient() {
  // Reading cookies first opts every caller into dynamic rendering, so a page
  // that touches user data is never prerendered at build time.
  const cookieStore = await cookies();
  assertNoPrivilegedKeys();
  const { supabaseUrl, publishableKey } = getPublicEnv();

  return createServerClient<Database>(supabaseUrl, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components cannot set cookies; proxy.ts refreshes the session instead.
        }
      },
    },
  });
}

export type ServerSupabaseClient = Awaited<ReturnType<typeof createClient>>;
