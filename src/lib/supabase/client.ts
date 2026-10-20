import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";
import { getPublicEnv } from "@/lib/env";

/**
 * Browser client using only the publishable key. Unused in the MVP (all data
 * access is server-side); kept for future client-side realtime features.
 */
export function createClient() {
  const { supabaseUrl, publishableKey } = getPublicEnv();
  return createBrowserClient<Database>(supabaseUrl, publishableKey);
}
