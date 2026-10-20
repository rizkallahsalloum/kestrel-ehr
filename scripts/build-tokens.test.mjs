import { describe, expect, it } from "vitest";
import { buildCss, cssVarName, flattenTokens, resolveToken, toCssValue } from "./build-tokens.mjs";

const tree = {
  semantic: {
    bg: { page: { type: "color", value: "{primitives.color.gray.50}", extensions: { x: 1 } } },
    radius: { card: { type: "dimension", value: "{primitives.radius.lg}" } },
    missing: { thing: { type: "dimension", value: "{primitives.nope}" } },
    alpha: { glow: { type: "color", value: "#356f511f" } },
  },
  primitives: {
    color: { gray: { 50: { type: "color", value: "#F6F2EAFF" } } },
    radius: { lg: { type: "dimension", value: 16 } },
  },
};

describe("design token build", () => {
  it("flattens tokens and ignores metadata", () => {
    const tokens = flattenTokens(tree);
    expect(tokens.get("semantic.bg.page")).toEqual({ type: "color", value: "{primitives.color.gray.50}" });
    expect([...tokens.keys()].some((k) => k.includes("extensions"))).toBe(false);
  });

  it("resolves references and formats CSS values", () => {
    const tokens = flattenTokens(tree);
    expect(toCssValue(resolveToken("semantic.bg.page", tokens))).toBe("#f6f2ea");
    expect(toCssValue(resolveToken("semantic.radius.card", tokens))).toBe("16px");
    expect(toCssValue(resolveToken("semantic.alpha.glow", tokens))).toBe("#356f511f");
    expect(resolveToken("semantic.missing.thing", tokens)).toBeUndefined();
  });

  it("emits only semantic variables and reports unresolved tokens", () => {
    const { css, unresolved } = buildCss(flattenTokens(tree), "fixture.json");
    expect(css).toContain(`${cssVarName("semantic.bg.page")}: #f6f2ea;`);
    expect(css).not.toContain("--k-primitives");
    expect(unresolved).toEqual(["semantic.missing.thing"]);
  });

  it("keeps opacity unitless, converts weight names and quotes multi-word families", () => {
    expect(toCssValue({ type: "dimension", value: 0.65 }, "semantic.opacity.muted")).toBe("0.65");
    expect(toCssValue({ type: "dimension", value: -0.25 }, "semantic.text-tracking.tight")).toBe("-0.25px");
    expect(toCssValue({ type: "string", value: "SemiBold" }, "semantic.text-weight.semibold")).toBe("600");
    expect(toCssValue({ type: "string", value: "IBM Plex Mono" }, "semantic.text-family.mono")).toBe('"IBM Plex Mono"');
    expect(toCssValue({ type: "string", value: "Inter" }, "semantic.text-family.primary")).toBe("Inter");
  });

  it("does not loop on circular references", () => {
    const tokens = flattenTokens({ semantic: { a: { type: "color", value: "{semantic.b}" }, b: { type: "color", value: "{semantic.a}" } } });
    expect(resolveToken("semantic.a", tokens)).toBeUndefined();
  });
});
