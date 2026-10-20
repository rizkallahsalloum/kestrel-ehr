import { z } from "zod";

const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url({ protocol: /^https?$/ }),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
});

export type PublicEnv = { supabaseUrl: string; publishableKey: string };

/**
 * The only configuration the app runtime needs. `process.env.NEXT_PUBLIC_*`
 * must be referenced literally so Next.js can inline the values for the browser.
 */
export function getPublicEnv(): PublicEnv {
  const parsed = publicEnvSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });
  if (!parsed.success) {
    throw new Error(
      `Invalid public Supabase configuration: ${parsed.error.issues.map((i) => i.path.join(".")).join(", ")}`,
    );
  }
  return {
    supabaseUrl: parsed.data.NEXT_PUBLIC_SUPABASE_URL,
    publishableKey: parsed.data.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  };
}

const FORBIDDEN_RUNTIME_SECRETS = ["SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY"] as const;

/**
 * Server-side check. All app data access goes through the signed-in user's
 * session so RLS applies; a privileged key in the runtime would make it
 * possible to bypass RLS by accident.
 */
export function assertNoPrivilegedKeys(env: Record<string, string | undefined> = process.env): void {
  const present = FORBIDDEN_RUNTIME_SECRETS.filter((key) => env[key]);
  if (present.length > 0) {
    throw new Error(`${present.join(", ")} must not be set in the app runtime. Keep it in .env.test only.`);
  }
}
