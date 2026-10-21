import { expect, test, type Page } from "@playwright/test";

// prefers-reduced-motion: every animation must be finished almost at once (globals.css shortens
// them to 0.001ms and one iteration; skeleton bars use motion-safe: and do not animate at all).
// The first test proves the check can see running animations when motion is allowed.

async function runningAnimations(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    document
      .getAnimations()
      .filter((a) => a.playState === "running")
      .map((a) => {
        const target = (a.effect as KeyframeEffect | null)?.target as Element | null;
        return `${(a as CSSAnimation).animationName ?? a.constructor.name} on ${target?.tagName.toLowerCase()}.${target?.className.toString().slice(0, 60)}`;
      }),
  );
}

async function open(page: Page, url: string): Promise<void> {
  await page.goto(url);
  await page.waitForLoadState("networkidle");
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
}

test("with motion allowed, the skeleton pulse runs (control)", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await open(page, "/dev/chart?skeleton=1");
  expect((await runningAnimations(page)).some((name) => name.startsWith("pulse"))).toBe(true);
});

test.describe("prefers-reduced-motion: reduce", () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
  });

  for (const [name, url] of [
    ["chart skeleton", "/dev/chart?skeleton=1"],
    ["prescribing skeleton", "/dev/prescribing?view=blocking&skeleton=1"],
    ["audit skeleton", "/dev/audit?skeleton=1"],
  ] as const) {
    test(`${name}: bars do not pulse`, async ({ page }) => {
      await open(page, url);
      const animated = await page
        .locator("[data-skeleton] [aria-hidden] *")
        .evaluateAll((els) => els.filter((el) => getComputedStyle(el).animationName !== "none").length);
      expect(animated).toBe(0);
      expect(await runningAnimations(page)).toEqual([]);
    });
  }

  test("chart fade-ins finish at once", async ({ page }) => {
    await open(page, "/dev/chart?view=blocking");
    const durations = await page
      .locator(".animate-fade-up, .animate-fade-up-2, .animate-fade-up-3, .animate-fade-up-context")
      .evaluateAll((els) => els.map((el) => getComputedStyle(el).animationDuration));
    expect(durations.length).toBe(4);
    for (const d of durations) expect(parseFloat(d), d).toBeLessThan(0.01);
    expect(await runningAnimations(page)).toEqual([]);
  });

  test("theme specimen motion row and dialog entrance finish at once", async ({ page }) => {
    await open(page, "/dev/theme");
    expect(await runningAnimations(page)).toEqual([]);
    await open(page, "/dev/components");
    await expect(async () => {
      await page.getByRole("button", { name: "Open dialog" }).click();
      await expect(page.getByRole("dialog")).toBeVisible({ timeout: 1_000 });
    }).toPass({ timeout: 30_000 });
    await page.waitForTimeout(50);
    expect(await runningAnimations(page)).toEqual([]);
  });

  test("combobox loading rows and spinner stop", async ({ page }) => {
    await open(page, "/dev/components");
    await page.getByRole("combobox", { name: "Loading state" }).focus();
    await page.waitForTimeout(50);
    expect(await runningAnimations(page)).toEqual([]);
  });

  test("critical status dot has no animation", async ({ page }) => {
    await open(page, "/dev/components");
    const dots = await page
      .locator("span[aria-hidden=true].rounded-full.bg-status-warning.outline-status-warning")
      .evaluateAll((els) => els.map((el) => getComputedStyle(el).animationName));
    expect(dots.length).toBeGreaterThan(0);
    expect(dots.every((name) => name === "none")).toBe(true);
  });
});
