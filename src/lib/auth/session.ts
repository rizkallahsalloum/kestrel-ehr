import "server-only";
import { cache } from "react";
import { createClient, type ServerSupabaseClient } from "@/lib/supabase/server";
import type { AppRole } from "@/types/domain";

export type CurrentUser = {
  id: string;
  fullName: string;
  role: AppRole;
};

/**
 * Verifies the session JWT (getClaims checks the signature; getSession is never
 * trusted on the server) and loads the active profile. Returns null for
 * anonymous, unknown or deactivated users.
 */
export async function resolveCurrentUser(supabase: ServerSupabaseClient): Promise<CurrentUser | null> {
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (error || !userId) return null;

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, full_name, role, is_active")
    .eq("id", userId)
    .maybeSingle();
  if (profileError || !profile || !profile.is_active) return null;

  return { id: profile.id, fullName: profile.full_name, role: profile.role };
}

/** Memoized for the duration of a single server request. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  return resolveCurrentUser(await createClient());
});
