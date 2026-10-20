import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseEnv } from "node:util";

export type TestEnv = {
  supabaseUrl: string;
  publishableKey: string;
  secretKey: string;
  dbUrl: string;
  projectRef: string;
  testUserPassword: string;
  accessToken: string | undefined;
};

const REQUIRED = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SECRET_KEY",
  "SUPABASE_DB_URL",
  "KESTREL_TEST_PROJECT_REF",
  "KESTREL_TEST_USER_PASSWORD",
] as const;

export class TestEnvError extends Error {}

export function projectRefFromUrl(url: string): string | null {
  const match = /^https:\/\/([a-z0-9]{20})\.supabase\.co\/?$/.exec(url.trim());
  return match?.[1] ?? null;
}

export function projectRefFromDbUrl(dbUrl: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(dbUrl);
  } catch {
    return null;
  }
  const userMatch = /^postgres\.([a-z0-9]{20})$/.exec(decodeURIComponent(parsed.username));
  if (userMatch) return userMatch[1] ?? null;
  const hostMatch = /^db\.([a-z0-9]{20})\.supabase\.co$/.exec(parsed.hostname);
  return hostMatch?.[1] ?? null;
}

/**
 * Validates that every URL points at the dedicated test project.
 * Pure so it can be unit tested without touching the filesystem.
 */
export function validateTestEnv(raw: Record<string, string | undefined>): TestEnv {
  const missing = REQUIRED.filter((key) => !raw[key]?.trim());
  if (missing.length > 0) {
    throw new TestEnvError(`Missing required test variables: ${missing.join(", ")}`);
  }
  const projectRef = raw.KESTREL_TEST_PROJECT_REF!.trim();
  const urlRef = projectRefFromUrl(raw.NEXT_PUBLIC_SUPABASE_URL!);
  const dbRef = projectRefFromDbUrl(raw.SUPABASE_DB_URL!);
  if (urlRef !== projectRef) {
    throw new TestEnvError("NEXT_PUBLIC_SUPABASE_URL does not point at KESTREL_TEST_PROJECT_REF.");
  }
  if (dbRef !== projectRef) {
    throw new TestEnvError("SUPABASE_DB_URL does not point at KESTREL_TEST_PROJECT_REF.");
  }
  if (raw.KESTREL_TEST_USER_PASSWORD!.length < 12) {
    throw new TestEnvError("KESTREL_TEST_USER_PASSWORD must be at least 12 characters.");
  }
  return {
    supabaseUrl: raw.NEXT_PUBLIC_SUPABASE_URL!.trim(),
    publishableKey: raw.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!.trim(),
    secretKey: raw.SUPABASE_SECRET_KEY!.trim(),
    dbUrl: raw.SUPABASE_DB_URL!.trim(),
    projectRef,
    testUserPassword: raw.KESTREL_TEST_USER_PASSWORD!,
    accessToken: raw.SUPABASE_ACCESS_TOKEN?.trim() || undefined,
  };
}

/** The value shipped in `.env.example`. It is public, so no seeded identity may use it. */
export const EXAMPLE_TEST_USER_PASSWORD = "CHANGE_ME_BEFORE_SEEDING";

const PLACEHOLDER_WORDS = ["change", "example", "placeholder"];

/**
 * Refuses placeholder seed passwords: the `.env.example` value and anything containing
 * "change", "example" or "placeholder" (any case). The message never includes the value.
 */
export function assertSeedablePassword(password: string): void {
  const lower = password.toLowerCase();
  if (password === EXAMPLE_TEST_USER_PASSWORD || PLACEHOLDER_WORDS.some((word) => lower.includes(word))) {
    throw new TestEnvError(
      "KESTREL_TEST_USER_PASSWORD looks like a placeholder. Set a long random value before seeding.",
    );
  }
}

/** Reads `.env.test` without copying its values into `process.env`. */
export function loadTestEnv(file = ".env.test"): TestEnv {
  const path = resolve(process.cwd(), file);
  if (!existsSync(path)) {
    throw new TestEnvError(`${file} not found. Copy .env.example to ${file} and fill in the kestrel-test values.`);
  }
  return validateTestEnv(parseEnv(readFileSync(path, "utf8")));
}
