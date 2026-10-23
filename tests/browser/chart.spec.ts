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
  await expect(slot.getByText("Allergy conflict on today's order", { exact: true })).toBeVisible();
  await expect(slot).toContainText("Draft: Zentoril 10 mg tablet. 1 blocking alert (change the draft or cancel it).");
  await expect(slot).toContainText("DEMO RULE: recorded allergy to demo class Alpha.");
  await expect(slot.getByRole("link", { name: "Review draft for Zentoril 10 mg tablet" })).toHaveAttribute(
    "href",
    /\/patients\/syn0000101\/prescriptions\/synrx00201$/,
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
  await expect(slot.getByText(/^Allergy conflict on/)).toHaveCount(0);

  const rows = page.getByRole("table", { name: "Prescriptions" }).locator("tbody tr");
  await expect(rows.nth(0)).toContainText("1 advisory alert to acknowledge");
  await expect(rows.nth(1)).toContainText("Safety check not run");
  await expect(page.getByRole("list", { name: "Active medications" }).getByText("from signed prescription")).toBeVisible();
});

test("severe allergies are red with a hairline card outline, mild and moderate orange; every icon is the triangle", async ({ page }) => {
  await open(page, "blocking");
  const card = allergyCard(page);
  // The emphasis width is for blocking alerts; the allergies card is a summary at the normal weight.
  expect(await borderColor(card)).toBe(await tokenColor(page, "danger-line"));
  expect(await borderWidth(card)).toBe("1px");
  const divider = card.getByRole("list", { name: "Active allergies" }).locator("li").nth(1);
  expect(await borderColor(divider)).toBe(await tokenColor(page, "danger-line"));
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
  // The mixed view's blocking draft has a past date: "pending order".
  await expect(banners.nth(0).getByText("Allergy conflict on pending order", { exact: true })).toBeVisible();
  await expect(banners.nth(0)).toContainText("Draft: Zentoril 10 mg tablet.");
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
  expect(h2).toEqual([
    "Demo safety alerts",
    "Vitals",
    "HbA1c and estimated average glucose",
    "Diagnoses",
    "Prescriptions",
    "Encounter notes",
    "Allergies",
    "Active medications",
  ]);
});

const vitalsBand = (page: Page) => page.getByRole("region", { name: "Vitals" });
const tile = (page: Page, kind: string) => vitalsBand(page).locator(`[data-vital=${kind}]`);

test("vitals: status by text and icon or dot, red only for critical, every tile the same size", async ({ page }) => {
  await open(page, "advisory");
  await expect(tile(page, "spo2")).toContainText("91");
  await expect(tile(page, "spo2").locator("[data-vital-status]")).toHaveText("Critical");
  await expect(tile(page, "spo2").locator("[data-vital-status] svg")).toHaveAttribute("data-icon", "alert-triangle");
  expect(await borderColor(tile(page, "spo2"))).toBe(await tokenColor(page, "danger"));
  expect(await borderWidth(tile(page, "spo2"))).toBe("2px");
  await expect(tile(page, "heart_rate").locator("[data-vital-status]")).toHaveText("Warning");
  expect(await textColor(tile(page, "heart_rate").locator("[data-vital-status]"))).toBe(await tokenColor(page, "warning"));
  expect(await borderWidth(tile(page, "heart_rate"))).toBe("1px");
  await expect(tile(page, "blood_pressure").locator("[data-vital-status]")).toHaveText("Stable");
  await expect(tile(page, "blood_pressure").locator("[data-status=stable]")).toHaveCount(1);
  await expect(vitalsBand(page)).toContainText("1 critical, 1 warning under the demo rules.");
  await expect(vitalsBand(page)).toContainText("illustrative demo rules, not clinical guidance");

  const sizes = await vitalsBand(page)
    .locator("[data-vital]")
    .evaluateAll((tiles) => tiles.map((t) => `${t.getBoundingClientRect().width}x${t.getBoundingClientRect().height}`));
  expect(new Set(sizes).size).toBe(1);
});

for (const [width, columns] of [
  [1440, 4],
  [1181, 4],
  [1024, 4],
  [800, 2],
  [761, 2],
  [760, 1],
  [390, 1],
] as const) {
  test(`vitals band: ${columns} tile column${columns === 1 ? "" : "s"} at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await open(page, "blocking");
    const xs = await vitalsBand(page)
      .locator("[data-vital]")
      .evaluateAll((tiles) => new Set(tiles.map((t) => Math.round(t.getBoundingClientRect().x))).size);
    expect(xs).toBe(columns);
  });
}

test("HbA1c chart: labelled axes, keyboard-reachable points with tooltips, and a data table", async ({ page }) => {
  await open(page, "blocking");
  const chart = page.locator("[data-hba1c-chart]");
  await expect(chart).toContainText("HbA1c (%)");
  await expect(chart).toContainText("eAG (mg/dL)");
  const points = chart.locator("[data-chart-point]");
  await expect(points).toHaveCount(6);
  await expect(points.first()).toHaveAccessibleName("Mar 2026: HbA1c 7.8%, eAG 177 mg/dL");
  await expect(points.last()).toHaveAccessibleName("Aug 2026: HbA1c 6.8%, eAG 148 mg/dL");

  // Tab reaches every point in order, and focus shows its tooltip.
  await page.getByRole("link", { name: "Review draft for Zentoril 10 mg tablet" }).focus();
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press("Tab");
    await expect(points.nth(i)).toBeFocused();
    await expect(points.nth(i).locator("[data-chart-tooltip]")).toBeVisible();
  }
  await expect(points.nth(0).locator("[data-chart-tooltip]")).toBeHidden();

  const table = chart.getByRole("table");
  await expect(table.locator("tbody tr")).toHaveCount(6);
  await expect(table.locator("tbody tr").nth(3)).toHaveText(/Jun 2026\s*7\.1\s*157/);

  await open(page, "advisory");
  await expect(page.getByText("No HbA1c results on file.")).toBeVisible();
  await expect(page.locator("[data-chart-point]")).toHaveCount(0);
});

test("diagnoses: ICD-10-CM codes, active first, row actions named after the row, no red", async ({ page }) => {
  await open(page, "blocking");
  const table = page.getByRole("table", { name: "Diagnoses" });
  const rows = table.locator("tbody tr");
  await expect(rows).toHaveCount(5);
  await expect(rows.nth(0)).toContainText("I10");
  await expect(rows.nth(4)).toContainText("M54.50");
  await expect(rows.nth(4)).toContainText(/resolved/i);
  await expect(table.getByRole("button", { name: "Resolve I10 Essential (primary) hypertension" })).toBeVisible();
  await expect(table.getByRole("button", { name: "Reopen M54.50 Low back pain, unspecified" })).toBeVisible();
  expect(await table.locator("[data-severity]").count()).toBe(0);

  // Edit shows the same Unsaved changes pattern as prescribing; Cancel returns focus to Edit.
  const edit = table.getByRole("button", { name: "Edit E78.5 Hyperlipidemia, unspecified" });
  await edit.click();
  const input = table.getByRole("textbox", { name: "Description" });
  await expect(input).toBeFocused();
  await expect(table.getByText("Unsaved changes")).toHaveCount(0);
  await input.fill("Hyperlipidemia, unspecified (edited)");
  await expect(table.getByText("Unsaved changes")).toBeVisible();
  await table.getByRole("button", { name: "Cancel" }).click();
  await expect(edit).toBeFocused();
  await expect(rows.nth(2)).toContainText("Hyperlipidemia, unspecified");
});

test("hero: three most recent active diagnoses on one line", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await open(page, "blocking");
  const hero = page.locator("main header").first();
  const tags = hero.locator("p", { hasText: "Active diagnoses:" });
  await expect(tags).toContainText("Essential (primary) hypertension");
  await expect(tags).toContainText("Hyperlipidemia, unspecified");
  await expect(tags).not.toContainText("Low back pain");
  const lineHeight = await tags.evaluate((el) => el.getBoundingClientRect().height);
  expect(lineHeight).toBeLessThan(32);
});

test("encounter notes: autosave reports Saved only after the save, and Unsaved changes while typing", async ({ page }) => {
  await open(page, "blocking");
  const note = page.getByRole("textbox", { name: "Your note for today" });
  const state = page.locator("[data-save-state]");
  await expect(state).toHaveText("No note for today yet");
  await note.fill("Synthetic note (example text).");
  await expect(state).toHaveAttribute("data-save-state", "dirty");
  await expect(state).toContainText("Unsaved changes");
  // The specimen's stub save resolves at once, so "Saving…" may not be observable.
  await expect(state).toContainText(/Saved \d\d:\d\d UTC/, { timeout: 5_000 });
  await expect(state).toHaveAttribute("data-save-state", "clean");
  const box = await state.boundingBox();

  await page.goto("/dev/chart?view=blocking&noteSave=conflict");
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
  await note.fill("Synthetic note that conflicts.");
  await expect(state).toHaveAttribute("data-save-state", "conflict", { timeout: 5_000 });
  await expect(page.getByRole("alert").filter({ hasText: "Not saved." })).toContainText("Copy your text, then reload.");
  await expect(note).toHaveValue("Synthetic note that conflicts.");
  expect((await state.boundingBox())!.height).toBeGreaterThanOrEqual(box!.height);
});

test("renew: a medication from a signed prescription links to a prefilled new draft", async ({ page }) => {
  await open(page, "no-drafts");
  const renew = sidePanel(page).getByRole("link", { name: "Renew Zentoril 10 mg tablet" });
  await expect(renew).toHaveAttribute("href", "/patients/syn0000103/prescriptions/new?renew=synrx00221");
  await open(page, "advisory");
  // The specimen's other medication has a source id but no loaded signed source: no Renew.
  await expect(sidePanel(page).getByRole("link", { name: /^Renew/ })).toHaveCount(0);
});
