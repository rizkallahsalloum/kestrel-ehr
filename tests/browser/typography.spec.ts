import { expect, test } from "@playwright/test";
import { reviewPath } from "./support";

// Regression check for the provisional line-height pairing (display-lg 40/40 and the heading sizes).
// Glyphs that extend past the line box show up as vertical scroll overflow. Two pairings overflow by a
// known amount (docs/theme.md); any other overflow, or a larger one, fails.
const KNOWN_GLYPH_OVERFLOW_PX: Record<string, number> = {
  "text-display-lg Fraunces": 4,
  'text-data-lg "IBM Plex Mono"': 1,
};

for (const width of [360, 760, 1280]) {
  test(`wrapped display and heading samples fit their line boxes at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/dev/theme");
    const section = page.locator("section", {
      has: page.getByRole("heading", { name: /Display and heading line heights/ }),
    });
    await expect(section).toBeVisible();

    const samples = await section.locator("[class*='max-w-']").evaluateAll((elements) =>
      elements.map((el) => {
        const style = getComputedStyle(el);
        const lineHeight = parseFloat(style.lineHeight);
        return {
          label: `${el.className.match(/text-[\w-]+/)?.[0]} ${style.fontFamily.split(",")[0]}`,
          fontSize: parseFloat(style.fontSize),
          lineHeight,
          lines: Math.round(el.clientHeight / lineHeight),
          overflowY: el.scrollHeight - el.clientHeight,
          overflowX: el.scrollWidth - el.clientWidth,
        };
      }),
    );

    expect(samples).toHaveLength(8);
    for (const sample of samples) {
      expect.soft(sample.lineHeight, sample.label).toBeGreaterThanOrEqual(sample.fontSize);
      expect.soft(sample.lines, sample.label).toBeGreaterThanOrEqual(2);
      expect.soft(sample.overflowY, sample.label).toBeLessThanOrEqual(KNOWN_GLYPH_OVERFLOW_PX[sample.label] ?? 0);
      expect.soft(sample.overflowX, sample.label).toBeLessThanOrEqual(0);
    }
    expect(await section.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);

    await section.screenshot({ path: reviewPath("typography", `typography-wrap-${width}.png`) });
  });
}
