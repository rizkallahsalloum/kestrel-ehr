import { describe, expect, it } from "vitest";
import { z } from "zod";
import { DB_ERROR, fail, isDbError, mapDbError, ok, validationFailure } from "./result";

describe("ActionResult helpers", () => {
  it("builds a success result", () => {
    expect(ok({ id: "x" })).toEqual({ ok: true, data: { id: "x" } });
  });

  it("builds a failure with optional message and field errors", () => {
    expect(fail("FORBIDDEN")).toEqual({
      ok: false,
      errors: { code: "FORBIDDEN", formErrors: [], fieldErrors: {} },
    });
    expect(fail("VALIDATION", "Bad", { quantity: ["Too low"] }).errors).toEqual({
      code: "VALIDATION",
      formErrors: ["Bad"],
      fieldErrors: { quantity: ["Too low"] },
    });
  });

  it("converts Zod errors into field errors", () => {
    const schema = z.object({ quantity: z.number().int().positive(), name: z.string().min(1) });
    const parsed = schema.safeParse({ quantity: -1, name: "" });
    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    const result = validationFailure(parsed.error);
    expect(result.errors.code).toBe("VALIDATION");
    expect(Object.keys(result.errors.fieldErrors).sort()).toEqual(["name", "quantity"]);
  });
});

describe("mapDbError", () => {
  it.each([
    [DB_ERROR.NOT_A_DRAFT, "CONFLICT"],
    [DB_ERROR.VERSION_CONFLICT, "CONFLICT"],
    [DB_ERROR.BLOCKING_ALERT, "RULE_VIOLATION"],
    [DB_ERROR.UNACKNOWLEDGED_ADVISORY, "RULE_VIOLATION"],
    [DB_ERROR.START_DATE_WINDOW, "VALIDATION"],
    ["42501", "FORBIDDEN"],
    ["P0002", "NOT_FOUND"],
    ["23514", "VALIDATION"],
  ])("maps %s to %s", (code, expected) => {
    expect(mapDbError({ code }).errors.code).toBe(expected);
  });

  it("attaches field errors for field-specific database errors", () => {
    expect(mapDbError({ code: DB_ERROR.START_DATE_WINDOW }).errors.fieldErrors).toHaveProperty("startDate");
  });

  it("never leaks raw database messages for unknown errors", () => {
    const result = mapDbError({ code: "XX000", message: "row contains Jane Doe" });
    expect(result.errors.code).toBe("INTERNAL");
    expect(JSON.stringify(result)).not.toContain("Jane Doe");
  });

  it("detects specific codes", () => {
    expect(isDbError({ code: "23505" }, "23505")).toBe(true);
    expect(isDbError(null, "23505")).toBe(false);
  });
});
