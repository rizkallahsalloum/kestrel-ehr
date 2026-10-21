import { expect, test, type Page } from "@playwright/test";
import { hideDevOverlay, LAYOUT_WIDTHS, reviewScreenshot } from "./support";

const COLUMNS = ["When (UTC)", "Action", "Actor", "Entity", "Patient", "Details"];

async function open(page: Page, query = ""): Promise<void> {
  await page.goto(`/dev/audit${query}`);
  await expect(page.getByRole("heading", { level: 1, name: "Audit log" })).toBeVisible();
  await hideDevOverlay(page);
}

for (const width of LAYOUT_WIDTHS) {
  test(`audit table: table above 760px, stacked cards at 760px and below, at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await open(page);

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, "page overflows horizontally").toBeLessThanOrEqual(0);
    await reviewScreenshot(page, "audit", `audit-${width}`);

    // Table semantics hold in both layouts, including the visually hidden header row.
    const table = page.getByRole("table");
    await expect(table.getByRole("columnheader")).toHaveText(COLUMNS);
    const rows = table.getByRole("row");
    await expect(rows).toHaveCount(8);
    const first = rows.nth(1);
    await expect(first.getByRole("cell")).toHaveCount(6);

    const cells = await first.getByRole("cell").evaluateAll((els) =>
      els.map((el) => {
        const r = el.getBoundingClientRect();
        return { x: r.x, y: r.y, width: r.width };
      }),
    );
    const headerRow = await table.locator("thead").boundingBox();
    const fieldLabel = first.getByRole("cell").nth(2).locator("[aria-hidden=true]").first();

    if (width > 760) {
      expect(headerRow!.height).toBeGreaterThan(1);
      for (let i = 1; i < cells.length; i++) {
        expect(cells[i]!.x, `cell ${i + 1} sits right of cell ${i}`).toBeGreaterThan(cells[i - 1]!.x);
        expect(Math.abs(cells[i]!.y - cells[0]!.y)).toBeLessThanOrEqual(1);
      }
      await expect(fieldLabel).toBeHidden();
    } else {
      // Header row is visually hidden but still in the accessibility tree (checked above).
      expect(headerRow!.height).toBeLessThanOrEqual(1);
      for (let i = 1; i < cells.length; i++) {
        expect(cells[i]!.y, `cell ${i + 1} sits below cell ${i}`).toBeGreaterThan(cells[i - 1]!.y);
        expect(Math.abs(cells[i]!.x - cells[0]!.x)).toBeLessThanOrEqual(1);
      }
      await expect(fieldLabel).toBeVisible();
      await expect(fieldLabel).toHaveText("Actor");
    }
  });
}

test("audit table: actions use the accent badge, never red", async ({ page }) => {
  await open(page);
  const badge = page.getByRole("cell").filter({ hasText: "prescription.cancelled" }).getByText("prescription.cancelled");
  const [badgeColor, accent, danger] = await Promise.all([
    badge.evaluate((el) => getComputedStyle(el).color),
    page.evaluate(() => {
      const probe = document.createElement("div");
      probe.style.color = "var(--color-accent)";
      document.body.append(probe);
      const color = getComputedStyle(probe).color;
      probe.remove();
      return color;
    }),
    page.evaluate(() => {
      const probe = document.createElement("div");
      probe.style.color = "var(--color-danger)";
      document.body.append(probe);
      const color = getComputedStyle(probe).color;
      probe.remove();
      return color;
    }),
  ]);
  expect(badgeColor).toBe(accent);
  expect(badgeColor).not.toBe(danger);
});

test("audit table: empty state replaces the table", async ({ page }) => {
  await open(page, "?view=empty");
  await expect(page.getByText("No audit events.")).toBeVisible();
  await expect(page.getByRole("table")).toHaveCount(0);
});
