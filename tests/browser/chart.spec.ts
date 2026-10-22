import { expect, test, type Locator, type Page } from "@playwright/test";
import { LAYOUT_WIDTHS, reviewPath, severityColourViolations } from "./support";

const WIDTHS = LAYOUT_WIDTHS;
const VIEWS = ["blocking", "advisory", "mixed", "no-drafts", "no-allergies"] as const;

const sidePanel = (page: Page) => page.getByRole("complementary", { name: "Allergies and medications" });
const alertSlot = (page: Page) => page.getByRole("region", { name: "Demo safety alerts" });
const allergyCard = (page: Page) => sidePanel(page).locator("section").first();

const textColor = (locator: Locator) => locator.evaluate((el) => getComputedStyle(el).color);
const borderColor = (locator: Locator) => locator.evaluate((el) => getComputedStyle(el).borderTopColor);
const borderWidth = (locator: Locator) => locator.evaluate((el) => getComputedStyle(el).borderTopWidth);
const style = (locator: Locator, property: "backgroundColor") =>
  locator.evaluate((el, p) => getComputedStyle(el)[p], property);

/** Resolved rgb() of a theme colour token, for comparing against computed styles. */
function tokenColor(page: Page, token: string): Promise<string> {
  return page.evaluate((name) => {
    const probe = document.createElement("div");
    probe.style.color = `var(--color-${name})`;
    document.body.append(probe);
    const color = getComputedStyle(probe).color;
    probe.remove();
    return color;
  }, token);
}

async function open(page: Page, view: (typeof VIEWS)[number]): Promise<void> {
  await page.goto(`/dev/chart?view=${view}`);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
}

for (const width of WIDTHS) {
  test(`chart lays out without horizontal overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    for (const view of VIEWS) {
      await open(page, view);
      // Let the fade-up entrance finish so screenshots and boxes show the final layout.
      await page.waitForTimeout(700);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect.soft(overflow, `${view} overflows horizontally`).toBeLessThanOrEqual(0);
      await page.screenshot({ path: reviewPath("chart", `chart-${view}-${width}.png`), fullPage: true, caret: "initial" });
    }

    await open(page, "blocking");
    await page.waitForTimeout(700);
    const hero = await page.getByRole("heading", { level: 1 }).boundingBox();
    const side = await sidePanel(page).boundingBox();
    if (!hero || !side) throw new Error("missing layout boxes");
    // The workspace has its own breakpoint (one column at 1180px and below); the global xl still starts at 1180.
    if (width > 1180) {
      expect(side.width).toBe(340);
      expect(side.x).toBeGreaterThan(hero.x + hero.width);
    } else {
      expect(side.y).toBeGreaterThan(hero.y + hero.height);
    }
    await expect(page.getByRole("link", { name: "Back to patients" })).toHaveCount(0);
    await expect(page.getByTestId("sync-status")).toBeVisible({ visible: width >= 1180 });
  });
}

test("blocking draft: critical banner links to the draft and offers no acknowledgement", async ({ page }) => {
  await open(page, "blocking");
  const slot = alertSlot(page);
  await expect(slot.getByText("Blocking demo alert on draft: Zentoril 10 mg tablet")).toBeVisible();
  await expect(slot).toContainText("1 blocking alert (change the draft or cancel it).");
  await expect(slot).toContainText("DEMO RULE: recorded allergy to demo class Alpha.");
  await expect(slot.getByRole("link", { name: "Review draft for Zentoril 10 mg tablet" })).toHaveAttribute(
    "href",
    /\/patients\/00000000-0000-4000-8000-000000000101\/prescriptions\/00000000-0000-4000-8000-000000000201$/,
  );
  await expect(page.getByRole("button", { name: /acknowledge/i })).toHaveCount(0);

  await expect(page.getByText("2 allergies · highest severe")).toBeVisible();
  const rows = page.getByRole("table", { name: "Prescriptions" }).locator("tbody tr");
  await expect(rows).toHaveCount(3);
  await expect(rows.nth(0)).toContainText("1 blocking alert");
  await expect(rows.nth(1)).toContainText(/Signed 02 Sept? 2026/);
  await expect(page.getByRole("link", { name: "New prescription draft" })).toBeVisible();
});

test("advisory draft: warning banner, plus a note for a draft without a safety check", async ({ page }) => {
  await open(page, "advisory");
  const slot = alertSlot(page);
  await expect(slot.getByText("Advisory demo alert to acknowledge on draft: Calvexa 250 mg capsule")).toBeVisible();
  await expect(slot).toContainText("1 advisory alert to acknowledge.");
  await expect(slot).toContainText("1 draft has not had a safety check on the saved version.");
  await expect(slot.getByText(/^Blocking demo alert/)).toHaveCount(0);

  const rows = page.getByRole("table", { name: "Prescriptions" }).locator("tbody tr");
  await expect(rows.nth(0)).toContainText("1 advisory alert to acknowledge");
  await expect(rows.nth(1)).toContainText("Safety check not run");
  await expect(page.getByRole("list", { name: "Active medications" }).getByText("from signed prescription")).toBeVisible();
});

test("severe allergies are red with the 2px outline, mild and moderate orange; every icon is the triangle", async ({ page }) => {
  await open(page, "blocking");
  const card = allergyCard(page);
  expect(await borderColor(card)).toBe(await tokenColor(page, "danger"));
  expect(await borderWidth(card)).toBe("2px");
  const cardIcon = card.getByRole("heading", { name: "Allergies" }).locator("svg");
  await expect(cardIcon).toHaveAttribute("data-icon", "alert-triangle");
  expect(await textColor(cardIcon)).toBe(await tokenColor(page, "danger"));
  expect(await textColor(card.getByText("Demo class Alpha agents"))).toBe(await tokenColor(page, "danger-ink"));
  expect(await textColor(card.getByText("Demo class Delta agents"))).toBe(await tokenColor(page, "warning"));
  const severeTag = card.getByText("Severe");
  expect(await textColor(severeTag)).toBe(await tokenColor(page, "danger"));
  expect(await borderWidth(severeTag)).toBe("2px");
  expect(await borderColor(severeTag)).toBe(await tokenColor(page, "danger"));
  const mildTag = card.getByText("Mild");
  expect(await textColor(mildTag)).toBe(await tokenColor(page, "warning"));
  expect(await borderWidth(mildTag)).toBe("1px");
  const badge = page.getByText("2 allergies · highest severe");
  expect(await textColor(badge)).toBe(await tokenColor(page, "danger-ink"));
  expect(await style(badge, "backgroundColor")).toBe(await tokenColor(page, "danger-subtle"));
  await expect(badge.locator("svg")).toHaveAttribute("data-icon", "alert-triangle");

  await open(page, "no-drafts");
  const advisoryCard = allergyCard(page);
  expect(await borderColor(advisoryCard)).toBe(await tokenColor(page, "warning-line"));
  expect(await borderWidth(advisoryCard)).toBe("1px");
  await expect(advisoryCard.getByRole("heading", { name: "Allergies" }).locator("svg")).toHaveAttribute(
    "data-icon",
    "alert-triangle",
  );
  for (const text of ["Demo class Gamma agents", "Moderate", "Demo class Beta agents", "Mild"]) {
    expect(await textColor(advisoryCard.getByText(text)), text).toBe(await tokenColor(page, "warning"));
  }
  const advisoryBadge = page.getByText("2 allergies · highest moderate");
  expect(await textColor(advisoryBadge)).toBe(await tokenColor(page, "warning"));
  expect(await style(advisoryBadge, "backgroundColor")).toBe(await tokenColor(page, "warning-subtle"));
  await expect(advisoryBadge.locator("svg")).toHaveAttribute("data-icon", "alert-triangle");
});

test("severe and critical map to error tokens, moderate and warning to warning tokens, on every chart view", async ({ page }) => {
  for (const view of VIEWS) {
    await open(page, view);
    const found = await severityColourViolations(page);
    expect(found.redOutsideCritical, `${view}: red outside a severe or critical state`).toEqual([]);
    expect(found.orangeInCritical, `${view}: orange inside a severe or critical state`).toEqual([]);
  }
  // Red is used: the blocking view has red on the banner, allergy card, pill and severe tag.
  await open(page, "blocking");
  await expect(page.locator("main [data-severity=critical]")).toHaveCount(5);
});

test("the allergy pill reads as a pill: one line, at least 28px tall, 12px medium text, spaced icon", async ({ page }) => {
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await open(page, "blocking");
    const pill = page.getByText("2 allergies · highest severe");
    const box = await pill.boundingBox();
    if (!box) throw new Error("missing pill");
    expect(box.height, `${width}px height`).toBeGreaterThanOrEqual(28);
    expect(box.height, `${width}px one line`).toBeLessThan(40);
    const metrics = await pill.evaluate((el) => {
      const s = getComputedStyle(el);
      return { size: s.fontSize, weight: s.fontWeight, gap: s.columnGap, padX: s.paddingLeft, padY: s.paddingTop, wrap: s.whiteSpace };
    });
    expect(metrics).toEqual({ size: "12px", weight: "500", gap: "6px", padX: "12px", padY: "4px", wrap: "nowrap" });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);

    // Privacy mode does not mask the allergy summary and does not move the pill.
    await page.getByTestId("privacy-toggle").click();
    await expect(page.locator("html")).toHaveAttribute("data-privacy", "on");
    // Sub-pixel tolerance: the masked name above can round the hero's line boxes by a fraction of a pixel.
    const masked = await pill.boundingBox();
    for (const key of ["x", "y", "width", "height"] as const) expect(Math.abs(masked![key] - box[key])).toBeLessThan(0.5);
    await page.screenshot({ path: reviewPath("chart", `allergy-pill-privacy-${width}.png`), caret: "initial" });
    await page.getByTestId("privacy-toggle").click();
  }
});

test("mixed: blocking banner first, allergies most severe first, draft badges neutral", async ({ page }) => {
  await open(page, "mixed");
  const banners = alertSlot(page).locator(":scope > div");
  await expect(banners).toHaveCount(2);
  await expect(banners.nth(0)).toContainText("Blocking demo alert on draft: Zentoril 10 mg tablet");
  await expect(banners.nth(1)).toContainText("Advisory demo alert to acknowledge on draft: Calvexa 250 mg capsule");
  expect(await borderWidth(banners.nth(0))).toBe("2px");
  expect(await borderColor(banners.nth(0))).toBe(await tokenColor(page, "danger"));
  expect(await borderColor(banners.nth(1))).toBe(await tokenColor(page, "warning-line"));
  expect(await borderWidth(banners.nth(1))).toBe("1px");
  await expect(banners.nth(0).locator("svg").first()).toHaveAttribute("data-icon", "alert-triangle");
  await expect(banners.nth(1).locator("svg").first()).toHaveAttribute("data-icon", "alert-triangle");
  expect(await style(banners.nth(0), "backgroundColor")).toBe(await tokenColor(page, "danger-subtle"));
  expect(await style(banners.nth(1), "backgroundColor")).toBe(await tokenColor(page, "warning-subtle"));
  expect(await textColor(banners.nth(0).locator("p").first())).toBe(await tokenColor(page, "danger-ink"));
  expect(await textColor(banners.nth(1).locator("p").first())).toBe(await tokenColor(page, "warning"));

  const names = await allergyCard(page).getByRole("list", { name: "Active allergies" }).locator("li p:first-child").allTextContents();
  expect(names).toEqual(["Demo class Alpha agents", "Demo class Gamma agents", "Demo class Beta agents"]);

  const draftBadge = page.getByRole("table", { name: "Prescriptions" }).getByText("draft", { exact: true }).first();
  expect(await textColor(draftBadge)).toBe(await tokenColor(page, "ink-secondary"));
  expect(await style(draftBadge, "backgroundColor")).toBe(await tokenColor(page, "surface-warm"));
  await page.screenshot({ path: reviewPath("chart", "chart-mixed-1440.png"), fullPage: true, caret: "initial" });
});

test("no drafts: dashed no-alert state", async ({ page }) => {
  await open(page, "no-drafts");
  await expect(alertSlot(page)).toContainText("No unresolved demo safety alerts on this patient's drafts.");
  await expect(alertSlot(page).getByRole("link")).toHaveCount(0);
});

test("no allergies: empty states with a neutral outline", async ({ page }) => {
  await open(page, "no-allergies");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Sampleton, Zoë");
  await expect(sidePanel(page).getByText("No active allergies recorded.")).toBeVisible();
  await expect(sidePanel(page).getByText("No active medications recorded.")).toBeVisible();
  await expect(page.getByText("No prescriptions yet.")).toBeVisible();
  expect(await borderColor(allergyCard(page))).toBe(await tokenColor(page, "line-subtle"));
});

test("chart headings form one outline under the patient name", async ({ page }) => {
  await open(page, "blocking");
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  const h2 = await page.getByRole("heading", { level: 2 }).allTextContents();
  expect(h2).toEqual(["Demo safety alerts", "Prescriptions", "Allergies", "Active medications"]);
});
