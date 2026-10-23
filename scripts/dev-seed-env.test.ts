import { describe, expect, it } from "vitest";
import { DevSeedEnvError, parseDevSeedArgs, validateDevSeedEnv } from "./dev-seed-env";
import { KESTREL_DEV_PROJECT_REF } from "./project-refs";
import { EXAMPLE_TEST_USER_PASSWORD } from "./test-env";

const DEV = KESTREL_DEV_PROJECT_REF;
const TEST = "abcdefghijklmnopqrst";
const OTHER = "zyxwvutsrqponmlkjihg";

function base(overrides: Record<string, string | undefined> = {}) {
  return {
    NEXT_PUBLIC_SUPABASE_URL: `https://${DEV}.supabase.co`,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_dev",
    SUPABASE_SECRET_KEY: "sb_secret_dev",
    SUPABASE_DB_URL: `postgresql://postgres.${DEV}:pw@aws-0-eu-central-1.pooler.supabase.com:5432/postgres`,
    KESTREL_DEV_PROJECT_REF: DEV,
    KESTREL_TEST_PROJECT_REF: TEST,
    KESTREL_DEV_SEED_PASSWORD: "q7Zr2xN9vLp4Kt8Wb3Hs",
    ...overrides,
  };
}

describe("Dev seed environment guard", () => {
  it("accepts a configuration where every URL points at Kestrel-Dev", () => {
    expect(validateDevSeedEnv(base()).projectRef).toBe(DEV);
  });

  it("refuses when the API URL points at another project", () => {
    expect(() => validateDevSeedEnv(base({ NEXT_PUBLIC_SUPABASE_URL: `https://${TEST}.supabase.co` }))).toThrow(
      /NEXT_PUBLIC_SUPABASE_URL/,
    );
  });

  it("refuses when the database URL points at another project", () => {
    expect(() =>
      validateDevSeedEnv(base({ SUPABASE_DB_URL: `postgresql://postgres:pw@db.${OTHER}.supabase.co:5432/postgres` })),
    ).toThrow(/SUPABASE_DB_URL/);
  });

  it("refuses a Dev ref that is not the Kestrel-Dev project", () => {
    expect(() =>
      validateDevSeedEnv(
        base({
          KESTREL_DEV_PROJECT_REF: OTHER,
          NEXT_PUBLIC_SUPABASE_URL: `https://${OTHER}.supabase.co`,
          SUPABASE_DB_URL: `postgresql://postgres.${OTHER}:pw@aws-0-eu-central-1.pooler.supabase.com:5432/postgres`,
        }),
      ),
    ).toThrow(/KESTREL_DEV_PROJECT_REF/);
  });

  it("refuses when the Dev ref equals the Test ref in the same file", () => {
    expect(() => validateDevSeedEnv(base({ KESTREL_TEST_PROJECT_REF: DEV }))).toThrow(/equals KESTREL_TEST_PROJECT_REF/);
  });

  it("refuses when the Dev ref equals the ref in .env.test", () => {
    expect(() => validateDevSeedEnv(base(), [DEV])).toThrow(/equals KESTREL_TEST_PROJECT_REF/);
  });

  it("refuses when required variables are missing", () => {
    expect(() => validateDevSeedEnv(base({ KESTREL_TEST_PROJECT_REF: "" }))).toThrow(/KESTREL_TEST_PROJECT_REF/);
  });

  it.each([EXAMPLE_TEST_USER_PASSWORD, "change-me-to-a-long-random-string", "an-EXAMPLE-password-123", "Placeholder-password-123"])(
    "refuses a placeholder password without echoing it (%#)",
    (password) => {
      let error: unknown;
      try {
        validateDevSeedEnv(base({ KESTREL_DEV_SEED_PASSWORD: password }));
      } catch (caught) {
        error = caught;
      }
      expect(error).toBeInstanceOf(DevSeedEnvError);
      expect((error as Error).message).toMatch(/KESTREL_DEV_SEED_PASSWORD/);
      expect((error as Error).message).not.toContain(password);
    },
  );

  it("refuses a short password", () => {
    expect(() => validateDevSeedEnv(base({ KESTREL_DEV_SEED_PASSWORD: "short-pw" }))).toThrow(/at least 12/);
  });
});

describe("Dev seed confirmation", () => {
  it("allows the dry run without confirmation", () => {
    expect(parseDevSeedArgs(["--dry-run"])).toBe("dry-run");
  });

  it("refuses the real run without --confirm-dev", () => {
    expect(() => parseDevSeedArgs([])).toThrow(/--confirm-dev/);
  });

  it.each([[["--confirm-dev"]], [["--confirm-dev", "yes"]], [["--confirm-dev", DEV.slice(0, 10)]], [["--confirm-dev", TEST]]])(
    "refuses a missing, partial or wrong ref (%#)",
    (argv) => {
      expect(() => parseDevSeedArgs(argv)).toThrow(DevSeedEnvError);
    },
  );

  it("accepts the full Dev ref", () => {
    expect(parseDevSeedArgs(["--", "--confirm-dev", DEV])).toBe("seed");
  });

  it("refuses --dry-run together with --confirm-dev", () => {
    expect(() => parseDevSeedArgs(["--dry-run", "--confirm-dev", DEV])).toThrow(/either/);
  });
});
