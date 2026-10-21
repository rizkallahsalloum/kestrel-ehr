import { describe, expect, it } from "vitest";
import { isDevOnlyPath, isDevPath } from "./dev-routes";

describe("isDevPath", () => {
  it("matches /dev routes in any environment, with or without a query", () => {
    expect(isDevPath("/dev")).toBe(true);
    expect(isDevPath("/dev/chart")).toBe(true);
    expect(isDevPath("/developer")).toBe(false);
    expect(isDevPath("/patients/dev")).toBe(false);
  });
});

describe("isDevOnlyPath", () => {
  it("matches /dev routes in development only", () => {
    expect(isDevOnlyPath("/dev/theme", "development")).toBe(true);
    expect(isDevOnlyPath("/dev", "development")).toBe(true);
    expect(isDevOnlyPath("/dev/theme", "production")).toBe(false);
    expect(isDevOnlyPath("/dev/theme", "test")).toBe(false);
    expect(isDevOnlyPath("/dev/theme", undefined)).toBe(false);
  });

  it("does not match lookalike or clinical paths", () => {
    expect(isDevOnlyPath("/developer", "development")).toBe(false);
    expect(isDevOnlyPath("/patients/dev", "development")).toBe(false);
    expect(isDevOnlyPath("/", "development")).toBe(false);
  });
});
