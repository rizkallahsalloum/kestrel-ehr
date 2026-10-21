import { expect, test, type Page } from "@playwright/test";
import { hideDevOverlay, LAYOUT_WIDTHS } from "./support";

// Loading skeletons must hold the final layout: same columns at every breakpoint step, same header
// box, and no layout shift when the real content streams in.

type Box = { x: number; y: number; width: number; height: number };
type Layout = { columns: Box[]; header: Box };

const CHART_WIDTHS = LAYOUT_WIDTHS;
const RX_WIDTHS = LAYOUT_WIDTHS;

/** Column boxes of the grid around `aside[aria-label=…]`, plus the header card above or inside it. */
function measure(page: Page, asideLabel: string, header: "first-in-main" | "before-grid"): Promise<Layout> {
  return page.evaluate(
    ([label, mode]) => {
      const rect = (el: Element | null | undefined) => {
        if (!el) throw new Error("missing layout element");
        const r = el.getBoundingClientRect();
        return { x: r.x, y: r.y + window.scrollY, width: r.width, height: r.height };
      };
      const aside = document.querySelector(`aside[aria-label="${label}"], [data-skeleton=aside]`);
      const grid = aside?.parentElement;
      if (!grid) throw new Error(`no grid around ${label}`);
      const columns = Array.from(grid.children, rect);
      const head =
        mode === "first-in-main"
          ? grid.children[0]?.firstElementChild
          : grid.closest("[data-layout=wide]")?.children[1];
      return { columns, header: rect(head) };
    },
    [asideLabel, header] as const,
  );
}

function expectSameBox(
  actual: Box,
  expected: Box,
  what: string,
  { height = true, y = true, heightTolerance = 0 }: { height?: boolean; y?: boolean; heightTolerance?: number } = {},
): void {
  expect.soft(actual.x, `${what} x`).toBeCloseTo(expected.x, 0);
  if (y) expect.soft(actual.y, `${what} y`).toBeCloseTo(expected.y, 0);
  expect.soft(actual.width, `${what} width`).toBeCloseTo(expected.width, 0);
  if (height) expect.soft(Math.abs(actual.height - expected.height), `${what} height`).toBeLessThanOrEqual(heightTolerance + 0.5);
}

for (const width of CHART_WIDTHS) {
  test(`chart skeleton matches the chart columns at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: "reduce" });

    await page.goto("/dev/chart?view=no-drafts&skeleton=1");
    await expect(page.locator("[data-skeleton=page]")).toContainText("Loading patient chart");
    await hideDevOverlay(page);
    const skeleton = await measure(page, "Allergies and medications", "first-in-main");

    await page.goto("/dev/chart?view=no-drafts");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await hideDevOverlay(page);
    const chart = await measure(page, "Allergies and medications", "first-in-main");

    // Two columns above 1180px, one at 1180px and below.
    const [main, aside] = chart.columns;
    if (width > 1180) expect(aside!.x).toBeGreaterThan(main!.x + main!.width);
    else expect(aside!.y).toBeGreaterThan(main!.y + main!.height);

    // On narrow screens a long patient name wraps onto a second line, which the skeleton cannot
    // predict; allow one heading line there.
    const nameLine = await page
      .getByRole("heading", { level: 1 })
      .evaluate((h1) => parseFloat(getComputedStyle(h1).lineHeight));
    expectSameBox(skeleton.header, chart.header, "hero", { heightTolerance: width <= 760 ? nameLine : 0 });
    // Stacked, the side column sits below chart content of varying length; only side by side
    // does its position belong to the layout.
    chart.columns.forEach((column, i) =>
      expectSameBox(skeleton.columns[i]!, column, `column ${i + 1}`, { height: false, y: i === 0 || width > 1180 }),
    );
  });
}

for (const width of RX_WIDTHS) {
  test(`prescribing skeleton matches the workspace columns at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: "reduce" });

    await page.goto("/dev/prescribing?view=new&skeleton=1");
    await expect(page.locator("[data-skeleton=page]")).toContainText("Loading prescription workspace");
    await hideDevOverlay(page);
    const skeleton = await measure(page, "Patient safety context", "before-grid");

    await page.goto("/dev/prescribing?view=new");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await hideDevOverlay(page);
    const workspace = await measure(page, "Patient safety context", "before-grid");

    // Three columns above 1280px, two above 820px (review below), one at 820px and below.
    const [context, form, review] = workspace.columns;
    if (width > 1280) {
      expect(form!.x).toBeGreaterThan(context!.x + context!.width);
      expect(review!.x).toBeGreaterThan(form!.x + form!.width);
    } else if (width > 820) {
      expect(form!.x).toBeGreaterThan(context!.x + context!.width);
      expect(review!.y).toBeGreaterThan(form!.y + form!.height);
      expect(review!.x).toBe(context!.x);
    } else {
      expect(form!.y).toBeGreaterThan(context!.y + context!.height);
      expect(review!.y).toBeGreaterThan(form!.y + form!.height);
    }

    // The specimen patient has a severe allergy, whose tile has the emphasis border; the skeleton
    // cannot know the severity and draws the standard border, so the box may differ by that width.
    const emphasisBorder = 2;
    expectSameBox(skeleton.header, workspace.header, "patient header", { heightTolerance: emphasisBorder });
    // Rows below the first grid row move with the height of the content above them, so y is
    // compared only for the first row (context column, and the form beside it when side by side).
    workspace.columns.forEach((column, i) => {
      const firstRow = i === 0 || (i === 1 && width > 820) || (i === 2 && width > 1280);
      expect
        .soft(Math.abs(skeleton.columns[i]!.y - column.y), `column ${i + 1} y`)
        .toBeLessThanOrEqual(firstRow ? emphasisBorder + 0.5 : Infinity);
      expectSameBox(skeleton.columns[i]!, column, `column ${i + 1}`, { height: false, y: false });
    });
  });
}

type AuditLayout = { heading: Box; intro: Box; card: Box; firstRow: Box; headers: Box[] };

/** Boxes of the audit page body (real view or skeleton): heading, intro, card, first row, headers. */
function measureAudit(page: Page): Promise<AuditLayout> {
  return page.evaluate(() => {
    const rect = (el: Element | null | undefined) => {
      if (!el) throw new Error("missing audit layout element");
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y + window.scrollY, width: r.width, height: r.height };
    };
    const root =
      document.querySelector("[data-skeleton=page] > [aria-hidden]") ??
      document.querySelector("main h1")?.parentElement;
    if (!root) throw new Error("no audit view");
    const card = root.children[2];
    return {
      heading: rect(root.children[0]),
      intro: rect(root.children[1]),
      card: rect(card),
      firstRow: rect(card?.querySelector("tbody tr")),
      headers: Array.from(card?.querySelectorAll("thead th") ?? [], rect),
    };
  });
}

for (const width of LAYOUT_WIDTHS) {
  test(`audit skeleton matches the audit table at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: "reduce" });

    await page.goto("/dev/audit?skeleton=1");
    await expect(page.locator("[data-skeleton=page]")).toContainText("Loading audit log");
    await hideDevOverlay(page);
    const skeleton = await measureAudit(page);

    await page.goto("/dev/audit");
    await expect(page.getByRole("heading", { level: 1, name: "Audit log" })).toBeVisible();
    await hideDevOverlay(page);
    const audit = await measureAudit(page);

    expectSameBox(skeleton.heading, audit.heading, "heading");
    expectSameBox(skeleton.intro, audit.intro, "intro");
    // The card grows with the rows, so only its position and width belong to the layout.
    expectSameBox(skeleton.card, audit.card, "card", { height: false });
    expectSameBox(skeleton.firstRow, audit.firstRow, "first row", { height: false });
    if (width > 760) {
      // Fixed table layout: the column boxes do not depend on the content.
      expect(audit.headers).toHaveLength(6);
      audit.headers.forEach((header, i) => expectSameBox(skeleton.headers[i]!, header, `column ${i + 1} header`));
    }
  });
}

/** Sums layout-shift entries (CLS without session windows) from navigation until now. */
async function observeLayoutShift(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as typeof window & { __layoutShift?: number };
    w.__layoutShift = 0;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as (PerformanceEntry & { value: number; hadRecentInput: boolean })[]) {
        if (!entry.hadRecentInput) w.__layoutShift! += entry.value;
      }
    }).observe({ type: "layout-shift", buffered: true });
  });
}

const layoutShift = (page: Page) =>
  page.evaluate(() => (window as typeof window & { __layoutShift?: number }).__layoutShift ?? 0);

for (const [name, url] of [
  ["chart", "/dev/chart?view=blocking&delay=1500"],
  ["new prescription", "/dev/prescribing?view=new&delay=1500"],
  ["saved prescription", "/dev/prescribing?view=blocking&delay=1500"],
  ["audit log", "/dev/audit?delay=1500"],
] as const) {
  for (const width of [1440, 1024, 390]) {
    test(`${name}: no layout shift when content replaces the skeleton at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await observeLayoutShift(page);
      await page.goto(url, { waitUntil: "commit" });
      await expect(page.locator("[data-skeleton=page]")).toBeAttached();
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 10_000 });
      await expect(page.locator("[data-skeleton=page]")).toHaveCount(0);
      // Let entrance animations and late font swaps settle before reading the total.
      await page.waitForTimeout(1000);
      expect(await layoutShift(page)).toBeLessThan(0.05);
    });
  }
}
