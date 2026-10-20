import { afterEach, describe, expect, it, vi } from "vitest";
import { assertNoPrivilegedKeys, getPublicEnv } from "./env";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("env", () => {
  it("parses the public Supabase configuration", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://abcdefghijklmnopqrst.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_x");
    expect(getPublicEnv()).toEqual({
      supabaseUrl: "https://abcdefghijklmnopqrst.supabase.co",
      publishableKey: "sb_publishable_x",
    });
  });

  it("rejects a missing or malformed configuration without echoing values", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "not-a-url");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");
    expect(() => getPublicEnv()).toThrow(/NEXT_PUBLIC_SUPABASE_URL/);
    expect(() => getPublicEnv()).not.toThrow(/not-a-url/);
  });

  it("refuses privileged keys in the app runtime", () => {
    expect(() => assertNoPrivilegedKeys({ SUPABASE_SECRET_KEY: "sb_secret_x" })).toThrow(/must not be set/);
    expect(() => assertNoPrivilegedKeys({})).not.toThrow();
  });
});
