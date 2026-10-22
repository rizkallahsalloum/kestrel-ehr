import { describe, expect, it } from "vitest";
import { isPublicPath } from "@/lib/supabase/proxy";
import { ageInYears, formatAgeSex } from "@/lib/format";
import { loginSchema } from "./schemas";

describe("loginSchema", () => {
  it("accepts a valid email and password", () => {
    expect(loginSchema.safeParse({ email: "clinician.a@kestrel.example", password: "x" }).success).toBe(true);
  });

  it.each([
    [{ email: "not-an-email", password: "x" }],
    [{ email: "a@b.example", password: "" }],
    [{ email: null, password: null }],
  ])("rejects %j", (input) => {
    expect(loginSchema.safeParse(input).success).toBe(false);
  });
});

describe("isPublicPath", () => {
  it("only treats the login page as public", () => {
    expect(isPublicPath("/login")).toBe(true);
    expect(isPublicPath("/patients")).toBe(false);
    expect(isPublicPath("/loginx")).toBe(false);
    expect(isPublicPath("/")).toBe(false);
  });
});

describe("ageInYears", () => {
  it("counts whole years in UTC", () => {
    const today = new Date("2026-04-11T12:00:00Z");
    expect(ageInYears("1968-04-12", today)).toBe(57);
    expect(ageInYears("1968-04-11", today)).toBe(58);
  });
});

describe("formatAgeSex", () => {
  const today = new Date("2026-04-11T12:00:00Z");
  it("joins age and the one-letter code with no space", () => {
    expect(formatAgeSex("1968-04-11", "female", today)).toBe("58F");
    expect(formatAgeSex("1968-04-12", "male", today)).toBe("57M");
  });
  it("spells out other values after a space", () => {
    expect(formatAgeSex("1968-04-11", "unknown", today)).toBe("58 unknown");
    expect(formatAgeSex("1968-04-11", "other", today)).toBe("58 other");
  });
});
