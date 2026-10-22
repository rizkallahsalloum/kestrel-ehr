import fs from "node:fs";
import path from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { REVIEW_DIR } from "./support";

// axe-core in a real browser on every development specimen and on interactive states. Serious and
// critical violations fail the test; moderate and minor ones are written to review-screenshots/axe/
// for the QA report. Nothing here is a screen-reader test.

type Finding = { state: string; width: number; id: string; impact: string; help: string; targets: string[] };
const AXE_DIR = path.join(REVIEW_DIR, "axe");

/** One file per scanned state, so a worker restart after a failure does not lose earlier results. */
function record(state: string, width: number, findings: Finding[]): void {
  fs.mkdirSync(AXE_DIR, { recursive: true });
  const file = `${state.replace(/[^a-z0-9]+/gi, "-")}-${width}.json`;
  fs.writeFileSync(path.join(AXE_DIR, file), JSON.stringify(findings, null, 2));
}

const PAGES: [string, string][] = [
  ["theme", "/dev/theme"],
  ["components", "/dev/components"],
  ...["clinician", "admin", "login", "not-found", "error", "placeholder"].map((v): [string, string] => [
    `shell ${v}`,
    `/dev/shell?view=${v}`,
  ]),
  ...["blocking", "advisory", "no-drafts", "mixed", "no-allergies"].map((v): [string, string] => [`chart ${v}`, `/dev/chart?view=${v}`]),
  ["chart skeleton", "/dev/chart?skeleton=1"],
  ...["new", "unevaluated", "blocking", "advisory", "mixed", "ready", "signed", "cancelled", "other-prescriber"].map(
    (v): [string, string] => [`prescribing ${v}`, `/dev/prescribing?view=${v}`],
  ),
  ["prescribing skeleton (new)", "/dev/prescribing?view=new&skeleton=1"],
  ["prescribing skeleton (saved)", "/dev/prescribing?view=blocking&skeleton=1"],
  ["audit", "/dev/audit"],
  ["audit empty", "/dev/audit?view=empty"],
  ["audit skeleton", "/dev/audit?skeleton=1"],
  ["server error screen", "/dev/error"],
  ["browser error screen", "/dev/error?kind=client"],
];

/** Pages that are layout-sensitive enough to scan at the narrow width as well. */
const NARROW = new Set(["shell clinician", "shell admin", "shell placeholder", "chart blocking", "prescribing blocking", "prescribing new", "audit"]);

async function scan(page: Page, state: string): Promise<void> {
  const width = page.viewportSize()?.width ?? 0;
  // Contrast-table swatches render UI-only and "not used" pairs as sample text on purpose;
  // contrast.spec checks each pair against its own threshold.
  const result = await new AxeBuilder({ page }).exclude("nextjs-portal").exclude("[data-contrast-sample]").analyze();
  record(
    state,
    width,
    result.violations.map((v) => ({
      state,
      width,
      id: v.id,
      impact: v.impact ?? "unknown",
      help: v.help,
      targets: v.nodes.map((n) => n.target.join(" ")),
    })),
  );
  const blocking = result.violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map((v) => `${v.impact} ${v.id}: ${v.help} -> ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
  expect(blocking, `${state} at ${width}px`).toEqual([]);
}

/** Live regions must not sit inside other live regions, or assistive tech may announce twice. */
async function expectNoNestedLiveRegions(page: Page, state: string): Promise<void> {
  const nested = await page.evaluate(() => {
    const live = "[role=alert], [role=status], [role=log], [aria-live]:not([aria-live=off])";
    return [...document.querySelectorAll(live)]
      .filter((el) => el.parentElement?.closest(live))
      .map((el) => `${el.tagName.toLowerCase()} ${el.textContent?.trim().slice(0, 60)}`);
  });
  expect(nested, state).toEqual([]);
}

async function settle(page: Page, url: string): Promise<void> {
  await page.goto(url);
  await page.waitForLoadState("networkidle");
}

for (const [state, url] of PAGES) {
  test(`axe: ${state}`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await settle(page, url);
    if (url.startsWith("/dev/error")) await expect(page.getByRole("main").getByRole("alert")).toBeVisible();
    await scan(page, state);
    await expectNoNestedLiveRegions(page, state);
    if (NARROW.has(state)) {
      await page.setViewportSize({ width: 390, height: 844 });
      await scan(page, state);
    }
  });
}

test("axe: dialog open (components specimen)", async ({ page }) => {
  await settle(page, "/dev/components");
  await expect(async () => {
    await page.getByRole("button", { name: "Open dialog" }).click();
    await expect(page.getByRole("dialog", { name: "Cancel this draft?" })).toBeVisible({ timeout: 1_000 });
  }).toPass({ timeout: 30_000 });
  await scan(page, "dialog open (components)");
});

test("axe: cancel-draft dialog open (prescribing)", async ({ page }) => {
  await settle(page, "/dev/prescribing?view=blocking");
  await expect(async () => {
    await page.getByRole("button", { name: "Cancel this draft" }).click();
    await expect(page.getByRole("dialog", { name: "Cancel this draft?" })).toBeVisible({ timeout: 1_000 });
  }).toPass({ timeout: 30_000 });
  await scan(page, "dialog open (prescribing cancel)");
});

test("axe: errors shown after a submit", async ({ page }) => {
  await settle(page, "/dev/components");
  const demo = page.getByTestId("submit-errors-demo");
  await expect(async () => {
    await demo.getByRole("button", { name: "Submit with errors" }).click();
    await expect(demo.getByRole("alert").first()).toBeVisible({ timeout: 1_000 });
  }).toPass({ timeout: 30_000 });
  await scan(page, "submit errors shown");
  await expectNoNestedLiveRegions(page, "submit errors shown");
});

test("axe: combobox expanded", async ({ page }) => {
  await settle(page, "/dev/components");
  const input = page.getByRole("combobox", { name: /Medication \(combobox\)/ });
  await expect(async () => {
    await input.focus();
    await page.keyboard.press("ArrowDown");
    await expect(input).toHaveAttribute("aria-expanded", "true", { timeout: 1_000 });
  }).toPass({ timeout: 30_000 });
  await scan(page, "combobox expanded (components)");

  await settle(page, "/dev/prescribing?view=new");
  const medication = page.getByRole("combobox", { name: /Medication \(synthetic catalog\)/ });
  await expect(async () => {
    await medication.focus();
    await page.keyboard.press("ArrowDown");
    await expect(medication).toHaveAttribute("aria-expanded", "true", { timeout: 1_000 });
  }).toPass({ timeout: 30_000 });
  await scan(page, "combobox expanded (prescribing)");
});

test("axe: top bar with 1, 3 and 7 queue patients, Privacy button hovered off and on", async ({ page }) => {
  test.setTimeout(420_000);
  for (const width of [2560, 1440, 1024, 760, 390]) {
    await page.setViewportSize({ width, height: 900 });
    for (const patients of [1, 3, 7]) {
      await settle(page, `/dev/prescribing?view=blocking&queue=${patients}`);
      await scan(page, `queue ${patients} at ${width}px`);
    }
    // Reordered queue: the teal, green and blue chip avatars land on other chips.
    await settle(page, "/dev/prescribing?view=blocking&queueOrder=rotated");
    await scan(page, `queue reordered at ${width}px`);
    const privacy = page.getByTestId("privacy-toggle");
    await privacy.hover();
    await scan(page, `privacy off hovered at ${width}px`);
    await expect(async () => {
      await privacy.click();
      await expect(privacy).toHaveAttribute("aria-pressed", "true", { timeout: 1_000 });
    }).toPass({ timeout: 30_000 });
    await scan(page, `privacy on hovered at ${width}px`);
    await page.mouse.move(0, 0);
    await scan(page, `privacy on at ${width}px`);
    await privacy.click();
  }
  // Six chips on the search row (inline from 2390px), shown and masked.
  await page.setViewportSize({ width: 2560, height: 900 });
  await settle(page, "/dev/chart?view=blocking&queue=6");
  await scan(page, "six chips inline at 2560px");
});

test("axe: buttons hovered and pressed on every variant", async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await settle(page, "/dev/components");
  for (const variant of ["primary", "secondary", "danger", "quiet", "link"]) {
    const live = page.locator(`[data-testid=button-states-${variant}] button:not(:disabled)`).first();
    await live.hover();
    await scan(page, `${variant} button hovered`);
    await page.mouse.down();
    await scan(page, `${variant} button pressed`);
    await page.mouse.up();
  }
  await page.getByTestId("button-link-specimen").hover();
  await scan(page, "button-styled link hovered");
  await page.mouse.move(0, 0);
});

test("axe: account menu open, Privacy on with the queue masked, and offline sync status", async ({ page }) => {
  test.setTimeout(240_000);
  for (const width of [2560, 1440, 1024, 760, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await settle(page, "/dev/chart?view=blocking");
    const trigger = page.getByRole("button", { name: /account menu/i });
    await expect(async () => {
      await trigger.click();
      await expect(page.getByRole("menu", { name: "Account" })).toBeVisible({ timeout: 1_000 });
    }).toPass({ timeout: 30_000 });
    await scan(page, "account menu open");
    await page.keyboard.press("Escape");
    await trigger.hover();
    await scan(page, `account menu trigger hovered at ${width}px`);
    await page.mouse.move(0, 0);

    await page.getByTestId("privacy-toggle").click();
    await expect(page.getByTestId("privacy-toggle")).toHaveAttribute("aria-pressed", "true");
    await scan(page, "privacy on with queue");
    await page.getByTestId("privacy-toggle").click();

    await page.context().setOffline(true);
    await expect(page.getByTestId("sync-status")).toHaveAttribute("data-online", "false");
    await scan(page, "sync offline");
    await page.context().setOffline(false);
  }
});