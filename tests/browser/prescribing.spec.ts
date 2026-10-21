import { expect, test, type Locator, type Page } from "@playwright/test";
import { LAYOUT_WIDTHS, reviewPath } from "./support";

const WIDTHS = LAYOUT_WIDTHS;
const VIEWS = ["new", "unevaluated", "blocking", "advisory", "mixed", "ready", "signed", "cancelled", "other-prescriber"] as const;
type View = (typeof VIEWS)[number];

const context = (page: Page) => page.getByRole("complementary", { name: "Patient safety context" });
const review = (page: Page) => page.getByRole("region", { name: /^(Review prescription|Signed|Cancelled|Draft)/ });
const signButton = (page: Page) => page.getByTestId("sign-button");
/** The workspace, without the specimen's view links (which reuse the status words). */
const workspace = (page: Page) => page.locator('[data-layout="wide"]');

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

const style = (locator: Locator, property: "color" | "backgroundColor" | "borderTopColor" | "borderTopWidth") =>
  locator.evaluate((el, p) => getComputedStyle(el)[p], property);
const icon = (locator: Locator) => locator.locator("svg[data-icon]").first();

async function open(page: Page, view: View): Promise<void> {
  await page.goto(`/dev/prescribing?view=${view}`);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
}

for (const width of WIDTHS) {
  test(`prescribing workspace lays out without horizontal overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    for (const view of VIEWS) {
      await open(page, view);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect.soft(overflow, `${view} overflows horizontally`).toBeLessThanOrEqual(0);
      await page.screenshot({ path: reviewPath("prescribing", `rx-${view}-${width}.png`), fullPage: true, caret: "initial" });
    }

    await open(page, "blocking");
    const side = await context(page).boundingBox();
    const form = await page.getByRole("region", { name: "Medication", exact: true }).boundingBox();
    const panel = await review(page).boundingBox();
    if (!side || !form || !panel) throw new Error("missing layout boxes");
    if (width > 1280) {
      // Three columns: 300px context, fluid form, 380px review.
      expect(side.width).toBe(300);
      expect(panel.width).toBe(380);
      expect(form.x).toBeGreaterThan(side.x + side.width);
      expect(panel.x).toBeGreaterThan(form.x + form.width);
    } else if (width > 820) {
      // Two columns; the review spans below both.
      expect(side.width).toBe(280);
      expect(form.x).toBeGreaterThan(side.x + side.width);
      expect(panel.y).toBeGreaterThan(form.y + form.height);
      expect(panel.x).toBe(side.x);
    } else {
      expect(form.y).toBeGreaterThan(side.y + side.height);
      expect(panel.y).toBeGreaterThan(form.y + form.height);
      expect(form.width).toBe(side.width);
    }
  });
}

test("review panel is sticky only in the three-column layout", async ({ page }) => {
  // The new-draft review panel is shorter than the form column, so it has room to stick.
  await page.setViewportSize({ width: 1440, height: 600 });
  await open(page, "new");
  await page.evaluate(() => window.scrollTo(0, 300));
  const pinned = await review(page).boundingBox();
  expect(pinned!.y).toBeGreaterThan(60);
  expect(pinned!.y).toBeLessThan(100);

  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(review(page)).toHaveCSS("position", "static");
});

test("new draft: combobox picks from the synthetic catalog and the tracker follows the form", async ({ page }) => {
  await open(page, "new");
  const tracker = page.getByRole("navigation", { name: "Prescription sections" });
  for (const name of ["Medication (not complete)", "Directions and supply (not complete)", "Review (not complete)"]) {
    await expect(tracker.getByRole("link", { name, exact: true })).toHaveAttribute("href", /^#rx-/);
  }
  await expect(review(page).getByText("Not saved", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Create draft" })).toHaveAttribute("form", "prescription-draft-form");

  const combobox = page.getByRole("combobox", { name: "Medication (synthetic catalog)" });
  await combobox.fill("calv");
  await page.getByRole("option", { name: /Calvexa 250 mg capsule/ }).click();
  const change = page.getByRole("button", { name: "Change medication" });
  await expect(change).toBeFocused();
  await expect(page.getByLabel("Strength")).toHaveValue("250 mg");
  await expect(page.getByLabel("Dose form")).toHaveValue("capsule");
  await expect(page.locator('input[name="medicationId"]')).toHaveValue("3e000000-0000-4000-8000-000000000002");

  await page.getByLabel("Dose amount").fill("1");
  await page.getByLabel("Dose unit").selectOption("capsule");
  await page.getByLabel("Frequency").selectOption("twice_daily");
  await page.getByLabel("Quantity").fill("28");
  await expect(page.getByText("Label preview: Take 1 capsule by mouth twice daily.")).toBeVisible();
  await expect(page.getByText("About 14 days at this dose.")).toBeVisible();
  await expect(tracker.getByRole("link", { name: /Medication \(complete\)/ })).toBeVisible();
  await expect(tracker.getByRole("link", { name: /Directions and supply \(complete\)/ })).toBeVisible();

  await change.click();
  await expect(combobox).toBeFocused();
});

test("unsaved changes: notice, saved summary unchanged, signing disabled", async ({ page }) => {
  await open(page, "ready");
  await page.getByRole("checkbox").check();
  await expect(signButton(page)).toBeEnabled();
  await expect(signButton(page)).toHaveText("Sign prescription (simulated)");

  await page.getByLabel("Quantity").fill("56");
  await expect(review(page).getByText("Unsaved changes. Save the draft to re-run the safety check.")).toBeVisible();
  await expect(signButton(page)).toBeDisabled();
  await expect(signButton(page)).toHaveText("Save your changes to sign");
  await expect(signButton(page)).toHaveAccessibleDescription("Save your changes: signing uses the saved version.");
  await expect(review(page).getByText("Save your changes: signing uses the saved version.")).toBeVisible();
  await expect(review(page).getByText("28 dispensed, 1 refill, 14 days")).toBeVisible();
  await expect(page.getByRole("button", { name: "Save draft" })).toBeEnabled();
  await expect(page.getByRole("link", { name: /Review \(not complete\)/ })).toBeVisible();
  await page.screenshot({ path: reviewPath("prescribing", "rx-unsaved-1280.png"), fullPage: true, caret: "initial" });
});

test("blocking alert: orange card with the emphasis outline, no acknowledgement, link to the medication section", async ({ page }) => {
  await open(page, "blocking");
  const alerts = page.getByRole("list", { name: "Safety alerts" });
  const card = alerts.getByRole("listitem");
  await expect(alerts.getByText("Blocking", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /acknowledge/i })).toHaveCount(0);
  expect(await style(card, "backgroundColor")).toBe(await tokenColor(page, "warning-subtle"));
  expect(await style(card, "borderTopColor")).toBe(await tokenColor(page, "warning-stroke"));
  expect(await style(card, "borderTopWidth")).toBe("2px");
  await expect(icon(card)).toHaveAttribute("data-icon", "alert-circle");
  await expect(card.getByRole("link", { name: "Go to medication" })).toHaveAttribute("href", "#rx-medication");
  await expect(page.getByRole("list", { name: "Signing prerequisites" })).toContainText("blocking demo alert");
  await expect(signButton(page)).toHaveText("Blocking alert: change or cancel the draft");
  await page.getByRole("checkbox").check();
  await expect(signButton(page)).toBeDisabled();
  const pill = review(page).getByText("1 blocking", { exact: true });
  await expect(pill).toBeVisible();
  expect(await style(pill, "color")).toBe(await tokenColor(page, "warning"));
  expect(await style(pill, "borderTopColor")).toBe(await tokenColor(page, "warning-stroke"));
  await expect(icon(pill)).toHaveAttribute("data-icon", "alert-circle");
  const summary = context(page).getByText("1 blocking alert", { exact: true });
  await expect(summary).toBeVisible();
  const summaryBox = summary.locator("xpath=..");
  expect(await style(summaryBox, "borderTopWidth")).toBe("2px");
  expect(await style(summaryBox, "borderTopColor")).toBe(await tokenColor(page, "warning-stroke"));
  await expect(icon(summary)).toHaveAttribute("data-icon", "alert-circle");

  const tile = page.getByRole("region", { name: "Patient", exact: true }).getByText("Severe allergy", { exact: true }).locator("xpath=..");
  expect(await style(tile, "borderTopWidth")).toBe("2px");
  expect(await style(tile, "backgroundColor")).toBe(await tokenColor(page, "warning-subtle"));
  await expect(icon(tile)).toHaveAttribute("data-icon", "alert-circle");
});

test("mixed alerts: blocking first, then advisory, then acknowledged; advisory has the hairline and triangle", async ({ page }) => {
  await open(page, "mixed");
  const cards = page.getByRole("list", { name: "Safety alerts" }).getByRole("listitem");
  await expect(cards).toHaveCount(3);
  await expect(cards.nth(0)).toContainText("Blocking");
  await expect(cards.nth(1).getByRole("button", { name: "Acknowledge advisory alert" })).toBeVisible();
  await expect(cards.nth(2)).toContainText("Acknowledged");

  expect(await style(cards.nth(0), "borderTopWidth")).toBe("2px");
  expect(await style(cards.nth(1), "borderTopWidth")).toBe("1px");
  expect(await style(cards.nth(1), "borderTopColor")).toBe(await tokenColor(page, "warning-line"));
  await expect(icon(cards.nth(0))).toHaveAttribute("data-icon", "alert-circle");
  await expect(icon(cards.nth(1))).toHaveAttribute("data-icon", "alert-triangle");
  for (const i of [0, 1]) expect(await style(cards.nth(i), "backgroundColor")).toBe(await tokenColor(page, "warning-subtle"));
  await page.screenshot({ path: reviewPath("prescribing", "rx-mixed-1440.png"), fullPage: true, caret: "initial" });
});

test("no detection state in the workspace is red; only the cancel confirm is", async ({ page }) => {
  const redTokens = ["danger", "danger-ink", "danger-subtle", "danger-line", "status-critical"];
  for (const view of VIEWS) {
    await open(page, view);
    const red = await workspace(page).evaluate((root, tokens) => {
      const probe = document.createElement("div");
      document.body.append(probe);
      const resolved = tokens.map((t) => {
        probe.style.color = `var(--color-${t})`;
        return getComputedStyle(probe).color;
      });
      probe.remove();
      return [...root.querySelectorAll("*")]
        .filter((el) => !el.closest("dialog"))
        .filter((el) => {
          const s = getComputedStyle(el);
          return [s.color, s.backgroundColor, s.borderTopColor].some((c) => resolved.includes(c));
        })
        .map((el) => el.outerHTML.slice(0, 80));
    }, redTokens);
    expect(red, view).toEqual([]);
  }
});

test("draft status badge is neutral", async ({ page }) => {
  await open(page, "other-prescriber");
  const badge = workspace(page).getByText("draft", { exact: true });
  expect(await style(badge, "color")).toBe(await tokenColor(page, "ink-secondary"));
  expect(await style(badge, "backgroundColor")).toBe(await tokenColor(page, "surface-warm"));
});

for (const width of WIDTHS) {
  test(`section tracker compacts instead of wrapping at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await open(page, "new");
    const tracker = page.getByRole("navigation", { name: "Prescription sections" });
    const links = tracker.getByRole("link");
    // The accessible name is the full label at every width.
    await expect(tracker.getByRole("link", { name: "Directions and supply (not complete)", exact: true })).toBeVisible();

    const inner = await tracker.evaluate((el) => {
      const s = getComputedStyle(el);
      return el.clientWidth - parseFloat(s.paddingLeft) - parseFloat(s.paddingRight);
    });
    const rem = 16;
    const boxes = await links.evaluateAll((els) => els.map((el) => el.getBoundingClientRect().toJSON() as DOMRect));
    // min-h-9 is 36px; a wrapped label would make the link taller.
    for (const box of boxes) expect(box.height, `link height at ${width}px`).toBeLessThanOrEqual(36);
    if (inner >= 20 * rem) {
      expect(new Set(boxes.map((b) => Math.round(b.y))).size, "one row").toBe(1);
    } else {
      expect(boxes[1]!.y).toBeGreaterThan(boxes[0]!.y);
    }
    // Full label from tracker-full (28rem) and when stacked; short label in a narrow row. sr-only text is 1px wide.
    const fullShown = inner >= 28 * rem || inner < 20 * rem;
    const fullWidth = await tracker.getByText("Directions and supply", { exact: true }).evaluate((el) => el.getBoundingClientRect().width);
    const shortWidth = await tracker.getByText("Directions", { exact: true }).evaluate((el) => el.getBoundingClientRect().width);
    expect(fullWidth > 1, `full label shown at ${width}px (tracker ${inner}px)`).toBe(fullShown);
    expect(shortWidth > 1, `short label shown at ${width}px (tracker ${inner}px)`).toBe(!fullShown);
    const overflow = await tracker.evaluate((el) => el.scrollWidth - el.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    await tracker.screenshot({ path: reviewPath("prescribing", `rx-tracker-${width}.png`) });
  });
}

test("advisory alert: orange card with an optional note and Acknowledge", async ({ page }) => {
  await open(page, "advisory");
  const card = page.getByRole("list", { name: "Safety alerts" }).getByRole("listitem");
  await expect(card.getByText("Advisory", { exact: true })).toBeVisible();
  expect(await style(card, "backgroundColor")).toBe(await tokenColor(page, "warning-subtle"));
  expect(await style(card, "borderTopColor")).toBe(await tokenColor(page, "warning-line"));
  await expect(card.getByLabel("Acknowledgement note (optional)")).toBeVisible();
  await expect(card.getByRole("button", { name: "Acknowledge advisory alert" })).toBeVisible();
  await expect(signButton(page)).toHaveText("Acknowledge 1 advisory alert to sign");
});

test("unsaved edits disable the safety check and Acknowledge, with a visible reason", async ({ page }) => {
  await open(page, "advisory");
  const evaluate = page.getByRole("button", { name: "Run safety check" });
  const acknowledge = page.getByRole("button", { name: "Acknowledge advisory alert" });
  await expect(evaluate).toBeEnabled();
  await expect(acknowledge).toBeEnabled();

  await page.getByLabel("Dose amount").fill("2");
  const evaluateReason = "Save your changes first: the safety check runs on the saved version.";
  const acknowledgeReason = "Save your changes first: acknowledgements belong to the saved version.";
  await expect(evaluate).toBeDisabled();
  await expect(evaluate).toHaveAccessibleDescription(evaluateReason);
  await expect(page.getByText(evaluateReason)).toBeVisible();
  await expect(acknowledge).toBeDisabled();
  await expect(acknowledge).toHaveAccessibleDescription(acknowledgeReason);
  await expect(page.getByText(acknowledgeReason)).toBeVisible();
  await expect(signButton(page)).toHaveAccessibleDescription(/advisory demo alert must be acknowledged/);
});

test("unevaluated draft: the sign button asks for the safety check", async ({ page }) => {
  await open(page, "unevaluated");
  await expect(review(page).getByText("The saved version has not been checked yet.")).toBeVisible();
  await expect(signButton(page)).toHaveText("Run the safety check to sign");
  await expect(page.getByRole("button", { name: "Run safety check" })).toBeEnabled();
});

test("cancel dialog keeps the draft on Escape and uses the red destructive confirm", async ({ page }) => {
  await open(page, "ready");
  const trigger = page.getByRole("button", { name: "Cancel this draft" });
  const dialog = page.getByRole("dialog", { name: "Cancel this draft?" });
  await trigger.click();
  await expect(dialog).toBeVisible();
  const confirm = dialog.getByRole("button", { name: "Cancel draft" });
  expect(await style(confirm, "backgroundColor")).toBe(await tokenColor(page, "danger"));
  await page.screenshot({ path: reviewPath("prescribing", "rx-cancel-dialog.png"), caret: "initial", animations: "disabled" });
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});

test("label preview shows the saved version as label text", async ({ page }) => {
  await open(page, "ready");
  await page.getByLabel("Quantity").fill("56");
  const trigger = page.getByRole("button", { name: "Preview label" });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Label preview" });
  await expect(dialog).toContainText("Take 1 capsule by mouth twice daily.");
  await expect(dialog).toContainText("Qty 28, refills 1");
  await expect(dialog).toContainText("Simulated label. Synthetic data, not dispensed.");
  await dialog.getByRole("button", { name: "Close" }).click();
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});

test("signed view is read only and says nothing was transmitted", async ({ page }) => {
  await open(page, "signed");
  await expect(workspace(page).getByText("signed", { exact: true })).toBeVisible();
  await expect(page.getByText("Signed (simulated). Not transmitted anywhere.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Run safety check" })).toHaveCount(0);
  await expect(page.getByRole("textbox")).toHaveCount(0);
  await expect(page.getByRole("list", { name: "Safety alerts" }).getByText("Acknowledged")).toBeVisible();
});

test("cancelled view announces the cancellation and offers no actions", async ({ page }) => {
  await open(page, "cancelled");
  await expect(workspace(page).getByText("cancelled", { exact: true })).toBeVisible();
  await expect(page.getByRole("status")).toContainText("This draft was cancelled");
  await expect(page.getByRole("button", { name: "Cancel this draft" })).toHaveCount(0);
  await expect(signButton(page)).toHaveCount(0);
});

test("another prescriber's draft is read only", async ({ page }) => {
  await open(page, "other-prescriber");
  await expect(workspace(page).getByText("draft", { exact: true })).toBeVisible();
  await expect(page.getByText("Only the prescriber can edit, sign or cancel this draft.")).toBeVisible();
  await expect(page.getByRole("checkbox")).toHaveCount(0);
  await expect(page.getByRole("textbox")).toHaveCount(0);
});

test("prescribing headings form one outline", async ({ page }) => {
  await open(page, "ready");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Calvexa 250 mg capsule");
  expect(await page.getByRole("heading", { level: 2 }).allTextContents()).toEqual([
    "Testcase, Rowan",
    "Medication safety",
    "Allergies",
    "Active medications",
    "Medication",
    "Directions and supply",
    "Instructions",
    "Review prescription",
  ]);
});
