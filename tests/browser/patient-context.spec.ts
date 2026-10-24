import { expect, test, type Page } from "@playwright/test";
import { hideDevOverlay, reviewScreenshot } from "./support";

// Phase 9d patient-context strip: sticks under the top bar on the chart and E-Rx pages, never
// overlaps it, adds no tab stops, follows Privacy mode like the hero; the E-Rx review panel repeats
// the identity next to Sign.

const CHART = "/dev/chart?view=blocking";
const ERX = "/dev/prescribing?view=ready";
const strip = (page: Page) => page.getByRole("region", { name: "Patient context" });
const privacyButton = (page: Page) => page.getByTestId("privacy-toggle");

async function open(page: Page, url: string, width: number): Promise<void> {
  await page.setViewportSize({ width, height: 900 });
  await page.goto(url);
  await page.waitForLoadState("networkidle");
  await hideDevOverlay(page);
}

async function turnOn(page: Page): Promise<void> {
  await expect(async () => {
    await privacyButton(page).click();
    await expect(privacyButton(page)).toHaveAttribute("aria-pressed", "true", { timeout: 1_000 });
  }).toPass({ timeout: 30_000 });
}

type Box = { top: number; bottom: number; left: number; right: number };
const box = (page: Page, selector: string) =>
  page.locator(selector).first().evaluate((el): Box => {
    const r = el.getBoundingClientRect();
    return { top: r.top, bottom: r.bottom, left: r.left, right: r.right };
  });

/** The strip's height token (`--patient-strip`), resolved to pixels. */
const stripToken = (page: Page) =>
  page.evaluate(() => {
    const probe = document.createElement("div");
    probe.style.height = "var(--patient-strip)";
    document.body.append(probe);
    const h = probe.getBoundingClientRect().height;
    probe.remove();
    return h;
  });

for (const width of [1440, 1024, 390]) {
  for (const url of [CHART, ERX]) {
    test(`sticks under the top bar without overlapping it on ${url} at ${width}px`, async ({ page }) => {
      await open(page, url, width);
      await page.addStyleTag({ content: "main { min-height: 300vh; }" });
      const bar = await box(page, "[data-topbar]");
      const before = await box(page, "[data-patient-strip]");
      expect(before.top, "below the top bar").toBeGreaterThanOrEqual(bar.bottom - 0.5);
      expect(before.bottom - before.top, "height matches --patient-strip").toBeCloseTo(await stripToken(page), 0);

      await page.evaluate(() => window.scrollTo(0, 1200));
      const barAfter = await box(page, "[data-topbar]");
      const after = await box(page, "[data-patient-strip]");
      expect(barAfter.top, "top bar still sticky").toBeCloseTo(0, 0);
      expect(after.top, "strip sticks to the bottom of the top bar").toBeCloseTo(barAfter.bottom, 0);
      // Full width of the content column, like the top bar.
      expect(after.left).toBeCloseTo(barAfter.left, 0);
      expect(after.right).toBeCloseTo(barAfter.right, 0);
      // The top bar (and the toast inside it) paints above the strip.
      const hit = await page.evaluate(({ x, y }) => Boolean(document.elementFromPoint(x, y)?.closest("[data-topbar]")), {
        x: barAfter.left + 4,
        y: barAfter.bottom - 1,
      });
      expect(hit).toBe(true);
      await reviewScreenshot(page, "patient-context", `${url.includes("chart") ? "chart" : "erx"}-scrolled-${width}`);
    });
  }
}

test("the sticky chart aside and E-Rx review column stop at the bottom of the strip at 1440px", async ({ page }) => {
  for (const [url, column, tall] of [
    [CHART, "[class*='workspace:sticky']", "main section:has(> h2)"],
    [ERX, "[data-layout='wide'] [class*='erx-wide:sticky']", "[data-layout='wide'] .grid > div:nth-child(2)"],
  ] as const) {
    await open(page, url, 1440);
    // A tall neighbouring column, so the sticky column's grid row has room to stick.
    await page.addStyleTag({ content: `${tall} { min-height: 300vh; }` });
    const start = (await box(page, column)).top;
    const stripBottom = (await box(page, "[data-patient-strip]")).bottom;
    await page.evaluate((y) => window.scrollTo(0, y), Math.ceil(start - stripBottom) + 400);
    expect((await box(page, column)).top, url).toBeCloseTo((await box(page, "[data-patient-strip]")).bottom, 0);
  }
});

test("one line from 761px; at 390px the name stays whole, DOB moves out and the rest fits in two lines", async ({ page }) => {
  await open(page, CHART, 1440);
  await expect(strip(page)).toContainText("Testcase, Rowan");
  await expect(strip(page)).toContainText("DOB");
  await expect(strip(page)).toContainText("SYN-000101");

  for (const url of [CHART, "/dev/chart?view=no-drafts"]) {
    await open(page, url, 390);
    const name = strip(page).locator("p").first();
    const metrics = await name.evaluate((el) => ({
      overflow: el.scrollWidth > el.clientWidth,
      ellipsis: getComputedStyle(el).textOverflow,
      lines: Math.round(el.getBoundingClientRect().height / parseFloat(getComputedStyle(el).lineHeight)),
    }));
    expect(metrics.overflow, `${url}: name is not clipped`).toBe(false);
    expect(metrics.ellipsis).not.toBe("ellipsis");
    expect(metrics.lines, `${url}: name on one line`).toBe(1);
    await expect(strip(page).getByText("DOB")).toBeHidden();
    await expect(strip(page)).toContainText("MRN");
    const height = await strip(page).evaluate((el) => el.getBoundingClientRect().height);
    expect(height, `${url}: two lines`).toBeCloseTo(await stripToken(page), 0);
    await reviewScreenshot(page, "patient-context", `${url.includes("no-drafts") ? "no-drafts" : "chart"}-390`);
  }
});

test("adds no tab stops, shown or masked", async ({ page }) => {
  await open(page, CHART, 1440);
  const focusable = "a[href], button, input, select, textarea, [tabindex]:not([tabindex='-1'])";
  await expect(strip(page).locator(focusable)).toHaveCount(0);
  await turnOn(page);
  await expect(strip(page).locator(focusable)).toHaveCount(0);

  // Tabbing from the top bar's last control goes on into the page without stopping in the strip.
  await page.keyboard.press("Shift+Tab");
  for (let i = 0; i < 40; i++) {
    await page.keyboard.press("Tab");
    expect(await strip(page).evaluate((el) => el.contains(document.activeElement))).toBe(false);
  }
});

test("text meets 4.5:1 against the strip background", async ({ page }) => {
  await open(page, CHART, 1440);
  const ratios = await strip(page).evaluate((section) => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    const rgb = (colour: string) => {
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillStyle = colour;
      ctx.fillRect(0, 0, 1, 1);
      return [...ctx.getImageData(0, 0, 1, 1).data.slice(0, 3)];
    };
    const luminance = (colour: string) => {
      const [r, g, b] = rgb(colour).map((v) => {
        const c = v / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
    };
    const bg = luminance(getComputedStyle(section).backgroundColor);
    return [...section.querySelectorAll("p")].map((p) => {
      const fg = luminance(getComputedStyle(p).color);
      return (Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05);
    });
  });
  expect(ratios).toHaveLength(2);
  for (const ratio of ratios) expect(ratio).toBeGreaterThanOrEqual(4.5);
});

test("Privacy mode masks the strip like the hero, without moving it", async ({ page }) => {
  await open(page, CHART, 1440);
  const before = await box(page, "[data-patient-strip]");
  await turnOn(page);
  const tree = await strip(page).ariaSnapshot();
  for (const value of ["Testcase", "Rowan", "SYN-000101", "1959"]) expect(tree).not.toContain(value);
  for (const el of await strip(page).locator("[data-private-value]").all()) {
    expect(await el.evaluate((node) => getComputedStyle(node).visibility)).toBe("hidden");
  }
  expect(await box(page, "[data-patient-strip]")).toEqual(before);
  await reviewScreenshot(page, "patient-context", "masked-1440");
  await privacyButton(page).click();
  await expect(strip(page)).toContainText("Testcase, Rowan");
});

test("the review panel names the patient, with DOB and MRN, right above Sign", async ({ page }) => {
  for (const width of [1440, 390]) {
    await open(page, ERX, width);
    const signingFor = page.locator("[data-signing-for]");
    await expect(signingFor).toContainText("Signing for");
    await expect(signingFor).toContainText("Testcase, Rowan");
    await expect(signingFor).toContainText("DOB");
    await expect(signingFor).toContainText("SYN-000101");
    const panel = await signingFor.boundingBox();
    const sign = await page.getByTestId("sign-button").boundingBox();
    expect(panel!.y + panel!.height).toBeLessThanOrEqual(sign!.y);
    expect(sign!.y - (panel!.y + panel!.height), "directly above Sign").toBeLessThan(200);
    await reviewScreenshot(page, "patient-context", `signing-for-${width}`);
  }
  // Only the editable draft shows it: read-only views have no Sign action.
  await open(page, "/dev/prescribing?view=signed", 1440);
  await expect(page.locator("[data-signing-for]")).toHaveCount(0);
  await expect(strip(page)).toBeVisible();
});
