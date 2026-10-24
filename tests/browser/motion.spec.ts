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

test("with motion allowed, the critical vitals banner's dot pulses three times and stops", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await open(page, "/dev/chart?view=advisory");
  const pulse = page.locator("main [role=alert] [data-alert-pulse]");
  const style = await pulse.evaluate((el) => {
    const s = getComputedStyle(el);
    return { name: s.animationName, count: s.animationIterationCount, duration: s.animationDuration };
  });
  expect(style).toEqual({ name: "alert-pulse", count: "3", duration: "1.5s" });
  // The dot animates, never the banner block.
  expect(await page.locator("main [role=alert]").evaluate((el) => getComputedStyle(el).animationName)).toBe("none");
  await page.waitForTimeout(5000);
  expect((await runningAnimations(page)).filter((name) => name.startsWith("alert-pulse"))).toEqual([]);
});

test("with motion allowed, the blocking draft banner's dot pulses three times and stops; advisory banners do not pulse", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await open(page, "/dev/chart?view=blocking");
  const banner = page.locator("main [role=alert]").filter({ hasText: "Allergy conflict" });
  const style = await banner.locator("[data-alert-pulse]").evaluate((el) => {
    const s = getComputedStyle(el);
    return { name: s.animationName, count: s.animationIterationCount, duration: s.animationDuration };
  });
  expect(style).toEqual({ name: "alert-pulse", count: "3", duration: "1.5s" });
  expect(await banner.evaluate((el) => getComputedStyle(el).animationName)).toBe("none");
  await page.waitForTimeout(5000);
  expect((await runningAnimations(page)).filter((name) => name.startsWith("alert-pulse"))).toEqual([]);

  await open(page, "/dev/chart?view=advisory");
  await expect(page.locator('main [role=status][data-severity="warning"] [data-alert-pulse]')).toHaveCount(0);
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

  test("critical vitals banner: the dot does not pulse", async ({ page }) => {
    await open(page, "/dev/chart?view=advisory");
    await expect(page.locator("main [role=alert]")).toContainText("Critical vital sign");
    expect(await page.locator("[data-alert-pulse]").evaluate((el) => getComputedStyle(el).animationName)).toBe("none");
    expect(await runningAnimations(page)).toEqual([]);
  });

  test("blocking draft banner: the dot does not pulse", async ({ page }) => {
    await open(page, "/dev/chart?view=blocking");
    const pulse = page.locator("main [role=alert]").filter({ hasText: "Allergy conflict" }).locator("[data-alert-pulse]");
    await expect(pulse).toHaveCount(1);
    expect(await pulse.evaluate((el) => getComputedStyle(el).animationName)).toBe("none");
    expect(await runningAnimations(page)).toEqual([]);
  });

  test("critical status dot has no animation", async ({ page }) => {
    await open(page, "/dev/components");
    const dots = await page
      .locator("[data-status=critical]")
      .evaluateAll((els) => els.map((el) => getComputedStyle(el).animationName));
    expect(dots.length).toBeGreaterThan(0);
    expect(dots.every((name) => name === "none")).toBe(true);
  });
});
