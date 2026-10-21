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
  ...["clinician", "admin", "login", "not-found", "error"].map((v): [string, string] => [`shell ${v}`, `/dev/shell?view=${v}`]),
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
const NARROW = new Set(["shell clinician", "shell admin", "chart blocking", "prescribing blocking", "prescribing new", "audit"]);

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
