import { describe, expect, it } from "vitest";
import {
  assertSeedablePassword,
  EXAMPLE_TEST_USER_PASSWORD,
  projectRefFromDbUrl,
  projectRefFromUrl,
  TestEnvError,
  validateTestEnv,
} from "./test-env";
import { KESTREL_DEV_PROJECT_REF } from "./project-refs";

const REF = "abcdefghijklmnopqrst";
const OTHER = "zyxwvutsrqponmlkjihg";

function base(overrides: Record<string, string | undefined> = {}) {
  return {
    NEXT_PUBLIC_SUPABASE_URL: `https://${REF}.supabase.co`,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
    SUPABASE_SECRET_KEY: "sb_secret_test",
    SUPABASE_DB_URL: `postgresql://postgres.${REF}:pw@aws-0-eu-central-1.pooler.supabase.com:5432/postgres`,
    KESTREL_TEST_PROJECT_REF: REF,
    KESTREL_TEST_USER_PASSWORD: "a-long-test-password",
    ...overrides,
  };
}

describe("test environment guard", () => {
  it("extracts project refs from API and database URLs", () => {
    expect(projectRefFromUrl(`https://${REF}.supabase.co`)).toBe(REF);
    expect(projectRefFromUrl("http://localhost:54321")).toBeNull();
    expect(projectRefFromDbUrl(`postgresql://postgres:pw@db.${REF}.supabase.co:5432/postgres`)).toBe(REF);
    expect(projectRefFromDbUrl("not a url")).toBeNull();
  });

  it("accepts a consistent test configuration", () => {
    expect(validateTestEnv(base()).projectRef).toBe(REF);
  });

  it("refuses when the API URL points at another project", () => {
    expect(() => validateTestEnv(base({ NEXT_PUBLIC_SUPABASE_URL: `https://${OTHER}.supabase.co` }))).toThrow(
      TestEnvError,
    );
  });

  it("refuses when the database URL points at another project", () => {
    expect(() =>
      validateTestEnv(base({ SUPABASE_DB_URL: `postgresql://postgres:pw@db.${OTHER}.supabase.co:5432/postgres` })),
    ).toThrow(/SUPABASE_DB_URL/);
  });

  it("refuses when required variables are missing", () => {
    expect(() => validateTestEnv(base({ SUPABASE_SECRET_KEY: "" }))).toThrow(/SUPABASE_SECRET_KEY/);
  });

  it("refuses a file that points consistently at Kestrel-Dev", () => {
    const dev = KESTREL_DEV_PROJECT_REF;
    expect(() =>
      validateTestEnv(
        base({
          NEXT_PUBLIC_SUPABASE_URL: `https://${dev}.supabase.co`,
          SUPABASE_DB_URL: `postgresql://postgres.${dev}:pw@aws-0-eu-central-1.pooler.supabase.com:5432/postgres`,
          KESTREL_TEST_PROJECT_REF: dev,
        }),
      ),
    ).toThrow(/Kestrel-Dev/);
  });

  it("refuses Kestrel-Dev even when only one URL names it", () => {
    expect(() => validateTestEnv(base({ NEXT_PUBLIC_SUPABASE_URL: `https://${KESTREL_DEV_PROJECT_REF}.supabase.co` }))).toThrow(
      /Kestrel-Dev/,
    );
  });
});

describe("seed password guard", () => {
  it.each([
    EXAMPLE_TEST_USER_PASSWORD,
    "change-me-to-a-long-random-string",
    "my-Changed-password-123",
    "an-EXAMPLE-password-123",
    "Placeholder-password-123",
  ])("refuses a placeholder value without echoing it (%#)", (password) => {
    let error: unknown;
    try {
      assertSeedablePassword(password);
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(TestEnvError);
    expect((error as Error).message).toMatch(/KESTREL_TEST_USER_PASSWORD/);
    expect((error as Error).message).not.toContain(password);
  });

  it("accepts a random value", () => {
    expect(() => assertSeedablePassword("q7Zr2xN9vLp4Kt8Wb3Hs")).not.toThrow();
  });
});
