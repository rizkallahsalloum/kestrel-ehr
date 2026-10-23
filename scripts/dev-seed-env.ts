import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseEnv } from "node:util";
import { KESTREL_DEV_PROJECT_REF } from "./project-refs.ts";
import { assertSeedablePassword, projectRefFromDbUrl, projectRefFromUrl, TestEnvError } from "./test-env.ts";

export const DEV_SEED_ENV_FILE = ".env.dev-seed";

export type DevSeedEnv = {
  supabaseUrl: string;
  publishableKey: string;
  secretKey: string;
  dbUrl: string;
  projectRef: string;
  seedPassword: string;
};

export type DevSeedMode = "dry-run" | "seed";

const REQUIRED = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SECRET_KEY",
  "SUPABASE_DB_URL",
  "KESTREL_DEV_PROJECT_REF",
  "KESTREL_TEST_PROJECT_REF",
  "KESTREL_DEV_SEED_PASSWORD",
] as const;

export class DevSeedEnvError extends Error {}

/**
 * Validates `.env.dev-seed`. Pure so it can be unit tested.
 * `otherTestRefs` are test refs read from elsewhere (for example `.env.test`); Dev must differ from all of them.
 * Messages name variables, never values.
 */
export function validateDevSeedEnv(
  raw: Record<string, string | undefined>,
  otherTestRefs: readonly string[] = [],
): DevSeedEnv {
  const missing = REQUIRED.filter((key) => !raw[key]?.trim());
  if (missing.length > 0) {
    throw new DevSeedEnvError(`Missing required Dev seed variables: ${missing.join(", ")}`);
  }
  const projectRef = raw.KESTREL_DEV_PROJECT_REF!.trim();
  if (projectRef !== KESTREL_DEV_PROJECT_REF) {
    throw new DevSeedEnvError("KESTREL_DEV_PROJECT_REF is not the Kestrel-Dev project this seed is written for.");
  }
  const testRefs = [raw.KESTREL_TEST_PROJECT_REF!.trim(), ...otherTestRefs.map((ref) => ref.trim())];
  if (testRefs.includes(projectRef)) {
    throw new DevSeedEnvError("KESTREL_DEV_PROJECT_REF equals KESTREL_TEST_PROJECT_REF. Dev and Test must be different projects.");
  }
  if (projectRefFromUrl(raw.NEXT_PUBLIC_SUPABASE_URL!) !== projectRef) {
    throw new DevSeedEnvError("NEXT_PUBLIC_SUPABASE_URL does not point at KESTREL_DEV_PROJECT_REF.");
  }
  if (projectRefFromDbUrl(raw.SUPABASE_DB_URL!) !== projectRef) {
    throw new DevSeedEnvError("SUPABASE_DB_URL does not point at KESTREL_DEV_PROJECT_REF.");
  }
  const seedPassword = raw.KESTREL_DEV_SEED_PASSWORD!;
  if (seedPassword.length < 12) {
    throw new DevSeedEnvError("KESTREL_DEV_SEED_PASSWORD must be at least 12 characters.");
  }
  try {
    assertSeedablePassword(seedPassword, "KESTREL_DEV_SEED_PASSWORD");
  } catch (error) {
    if (error instanceof TestEnvError) throw new DevSeedEnvError(error.message);
    throw error;
  }
  return {
    supabaseUrl: raw.NEXT_PUBLIC_SUPABASE_URL!.trim(),
    publishableKey: raw.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!.trim(),
    secretKey: raw.SUPABASE_SECRET_KEY!.trim(),
    dbUrl: raw.SUPABASE_DB_URL!.trim(),
    projectRef,
    seedPassword,
  };
}

/**
 * `--dry-run` reads only. Anything else must be `--confirm-dev <Dev ref>` typed in full;
 * without it only the dry run is possible.
 */
export function parseDevSeedArgs(argv: readonly string[]): DevSeedMode {
  if (argv.includes("--dry-run")) {
    if (argv.includes("--confirm-dev")) {
      throw new DevSeedEnvError("Use either --dry-run or --confirm-dev, not both.");
    }
    return "dry-run";
  }
  const flag = argv.indexOf("--confirm-dev");
  if (flag === -1) {
    throw new DevSeedEnvError(
      `The real Dev seed needs --confirm-dev ${KESTREL_DEV_PROJECT_REF}. Run \`pnpm db:seed:dev:dry\` first.`,
    );
  }
  if (argv[flag + 1] !== KESTREL_DEV_PROJECT_REF) {
    throw new DevSeedEnvError(`--confirm-dev must be followed by the full Dev project ref (${KESTREL_DEV_PROJECT_REF}).`);
  }
  return "seed";
}

/** Reads only KESTREL_TEST_PROJECT_REF from a test env file, if the file exists. */
export function readTestProjectRef(file = ".env.test"): string | null {
  const path = resolve(process.cwd(), file);
  if (!existsSync(path)) return null;
  return parseEnv(readFileSync(path, "utf8")).KESTREL_TEST_PROJECT_REF?.trim() || null;
}

/** Reads `.env.dev-seed` without copying its values into `process.env`. */
export function loadDevSeedEnv(file = DEV_SEED_ENV_FILE): DevSeedEnv {
  const path = resolve(process.cwd(), file);
  if (!existsSync(path)) {
    throw new DevSeedEnvError(`${file} not found. Copy .env.dev-seed.example to ${file} and fill in the Kestrel-Dev values.`);
  }
  const testRef = readTestProjectRef();
  return validateDevSeedEnv(parseEnv(readFileSync(path, "utf8")), testRef ? [testRef] : []);
}
