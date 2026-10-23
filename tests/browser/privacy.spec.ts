import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { PRIVACY_FIELD_REVEAL_MS, PRIVACY_IDLE_MS } from "../../src/features/privacy/config";
import { hideDevOverlay, reviewScreenshot } from "./support";

// Privacy mode masks patient values in place (PrivateText, PrivateField) on the /dev/privacy specimen
// and on the chart, prescribing and patient list specimens. A masked value must not be in the
// page text or the accessibility tree; safety alerts stay readable.

const URL = "/dev/privacy";
const privacyButton = (page: Page) => page.getByTestId("privacy-toggle");
const liveText = (page: Page) => page.locator("header [aria-live=polite]");
/** Visible mask buttons only: the patient list repeats some values in a mobile line hidden at wider widths. */
const revealButton = (page: Page, label: string) =>
  page.getByRole("button", { name: `${label} hidden, press to reveal`, exact: true }).filter({ visible: true });

/** Patient values on /dev/privacy that Privacy mode must hide. */
const PRIVATE_VALUES = [
  "Testcase",
  "Rowan",
  "Demoson",
  "SYN-000101",
  "SYN-000102",
  "Calvexa",
  "Synthetic condition A",
  // Phase 9 clinical content: diagnosis code and text, vitals values, HbA1c and eAG values.
  "Essential (primary) hypertension",
  "E11.9",
  "148/92",
  "98.4",
  "6.8%",
  "148 mg/dL",
];

/**
 * Text of the content area outside form controls and masked regions: both keep their content
 * mounted (hidden, inert and out of the accessibility tree) so that nothing moves.
 */
function mainText(page: Page): Promise<string> {
  return page.evaluate(() => {
    const main = document.querySelector("main")!.cloneNode(true) as HTMLElement;
    main.querySelectorAll("input, textarea, select").forEach((control) => control.remove());
    main
      .querySelectorAll("[data-private-region] > [data-private-value]:not([data-revealed])")
      .forEach((region) => region.remove());
    return main.textContent ?? "";
  });
}

async function expectMasked(page: Page): Promise<void> {
  const text = await mainText(page);
  const tree = await page.getByRole("main").ariaSnapshot();
  for (const value of PRIVATE_VALUES) {
    expect(text, `page text contains ${value}`).not.toContain(value);
    expect(tree, `accessibility tree contains ${value}`).not.toContain(value);
  }
}

/** Block-level boxes in the content area plus the top bar and every private value. */
function boxes(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    // Visually hidden text (sr-only accessible names) has no visible box to shift.
    const selector = "main :is(tr, section, header, h1, h2, p, li, dd, [data-private]):not(.sr-only *), header > div";
    return [...document.querySelectorAll(selector)].map((el) => {
      const r = el.getBoundingClientRect();
      return `${el.tagName} ${r.x.toFixed(2)},${r.y.toFixed(2)} ${r.width.toFixed(2)}x${r.height.toFixed(2)}`;
    });
  });
}

/**
 * Records every animation frame in which Privacy mode is stored as on but a private value that was
 * not revealed is painted, and every moment the <html> attribute is missing.
 */
async function watchForLeaks(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as unknown as { __leaks: string[] };
    w.__leaks = [];
    const stored = () => {
      try {
        return sessionStorage.getItem("kestrel.privacy") === "on";
      } catch {
        return false;
      }
    };
    const frame = () => {
      if (stored()) {
        if (document.querySelector("main") && document.documentElement.getAttribute("data-privacy") !== "on") {
          w.__leaks.push(`attribute missing on ${location.pathname}${location.search}`);
        }
        for (const el of document.querySelectorAll("[data-private-value]:not([data-revealed])")) {
          if (getComputedStyle(el).visibility !== "hidden") {
            w.__leaks.push(`visible value on ${location.pathname}${location.search}: ${el.textContent?.slice(0, 20)}`);
          }
        }
      }
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });
}

const leaks = (page: Page) => page.evaluate(() => (window as unknown as { __leaks: string[] }).__leaks);

async function open(page: Page, url = URL): Promise<void> {
  await page.goto(url);
  await page.waitForLoadState("networkidle");
  await hideDevOverlay(page);
}

/** Clicks Privacy until hydration has attached the handler. */
async function turnOn(page: Page): Promise<void> {
  await expect(async () => {
    await privacyButton(page).click();
    await expect(privacyButton(page)).toHaveAttribute("aria-pressed", "true", { timeout: 1_000 });
  }).toPass({ timeout: 30_000 });
}

for (const width of [1440, 1024, 390]) {
  test(`Privacy masks values in place without moving anything, and keeps alerts readable, at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await open(page);
    const before = await boxes(page);
    expect(await mainText(page)).toContain("Testcase, Rowan");

    await turnOn(page);
    await expect(privacyButton(page)).toBeFocused();
    await expect(liveText(page)).toHaveText("Patient details hidden");
    await expectMasked(page);
    // Today's queue: names and initials masked, status kept, each chip still distinguishable.
    const queue = page.getByRole("navigation", { name: "Today's queue" }).filter({ visible: true });
    const queueTree = await queue.ariaSnapshot();
    for (const name of ["Rowan", "Testcase", "Mira", "Demoson", "RT", "MD"]) expect(queueTree).not.toContain(name);
    await expect(queue.getByRole("link", { name: "Patient 1 of 6, name hidden, Critical alert" })).toBeVisible();
    await expect(queue.getByRole("link", { name: "Patient 2 of 6, name hidden, Warning" })).toBeVisible();
    await expect(revealButton(page, "Patient name").first()).toBeVisible();
    await expect(revealButton(page, "Notes")).toBeVisible();
    await expect(page.getByRole("link", { name: "Patient name hidden" })).toHaveCount(2);
    // No session-lock overlay: the page stays usable.
    await expect(page.getByRole("button", { name: "Show content" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "chart specimen" })).toBeVisible();
    // Safety information stays: severity, drug and allergen names.
    const alert = page.getByText("Allergy conflict on pending order");
    await expect(alert).toBeVisible();
    await expect(page.getByText(/Draft: Zentoril 10 mg tablet\./)).toBeVisible();
    await expect(page.getByText(/severe DEMO-ALPHA class allergy/)).toBeVisible();
    await expect(page.getByRole("list", { name: "Active allergies" })).toContainText("DEMO-ALPHA class (synthetic)");
    // The masked notes control keeps its value but cannot be focused.
    const notes = page.locator("#privacy-notes");
    await expect(notes).toHaveValue(/Synthetic note/);
    expect(await notes.evaluate((el) => Boolean(el.closest("[inert]")))).toBe(true);

    expect(await boxes(page), "layout after masking").toEqual(before);
    await reviewScreenshot(page, "privacy", `masked-${width}`);

    await privacyButton(page).click();
    await expect(liveText(page)).toHaveText("Patient details shown");
    expect(await mainText(page)).toContain("Testcase, Rowan");
    expect(await boxes(page), "layout after showing").toEqual(before);
  });
}

test("clinical content: values, sparklines and the HbA1c chart are masked; vitals status stays readable", async ({ page }) => {
  await page.clock.install();
  await open(page);
  const chart = page.locator("[data-hba1c-chart]");
  await expect(chart.locator("[data-chart-point]")).toHaveCount(6);
  await turnOn(page);
  await expectMasked(page);

  // Status text, units and the diagnosis status badge stay visible; values and trend lines do not.
  const band = page.getByRole("region", { name: "Vitals" });
  await expect(band.locator("[data-vital=blood_pressure]")).toContainText("Warning");
  await expect(band.locator("[data-vital=blood_pressure]")).toContainText("mmHg");
  await expect(band.locator("[data-vital=heart_rate]")).toContainText("Stable");
  for (const line of await band.locator("[data-sparkline]").all()) {
    expect(await line.evaluate((el) => getComputedStyle(el).visibility)).toBe("hidden");
  }
  await expect(page.getByRole("table", { name: "Diagnoses" }).getByText("active").first()).toBeVisible();
  // Row actions are named without the diagnosis while masked.
  await expect(page.getByRole("button", { name: "Resolve Diagnosis hidden" }).first()).toBeVisible();

  // The chart is one masked region: hidden, inert, with a single reveal button.
  expect(await chart.evaluate((el) => Boolean(el.closest("[inert]")))).toBe(true);
  expect(await chart.evaluate((el) => getComputedStyle(el).visibility)).toBe("hidden");
  const reveal = revealButton(page, "HbA1c chart");
  await expect(reveal).toHaveCount(1);
  await reveal.click();
  await expect(liveText(page)).toHaveText("HbA1c chart shown");
  await expect(chart).toBeVisible();
  await chart.locator("[data-chart-point]").first().focus();
  await expect(chart.locator("[data-chart-point]").first()).toHaveAccessibleName("Mar 2026: HbA1c 7.8%, eAG 177 mg/dL");

  // Focus inside keeps it shown; after focus leaves it masks itself again.
  await page.clock.fastForward(PRIVACY_FIELD_REVEAL_MS + 1_000);
  await expect(chart).toBeVisible();
  await privacyButton(page).focus();
  await page.clock.fastForward(PRIVACY_FIELD_REVEAL_MS + 1_000);
  await expect(revealButton(page, "HbA1c chart")).toBeVisible();
  await expectMasked(page);
});

test("a masked field reveals by click, Enter or Space, alone, and masks itself again after the reveal period", async ({ page }) => {
  await page.clock.install();
  await open(page);
  await turnOn(page);

  const mrn = revealButton(page, "MRN").first();
  await mrn.click();
  await expect(liveText(page)).toHaveText("MRN shown");
  const revealed = page.locator("[data-revealed]");
  await expect(revealed).toHaveText("SYN-000101");
  await expect(revealed).toBeFocused();
  // Only that field: the patient's name and the other MRN stay masked.
  expect(await mainText(page)).not.toContain("Testcase");
  expect(await mainText(page)).not.toContain("SYN-000102");

  await page.clock.fastForward(PRIVACY_FIELD_REVEAL_MS - 1_000);
  await expect(revealed).toHaveText("SYN-000101");
  await page.clock.fastForward(2_000);
  await expect(page.locator("[data-revealed]")).toHaveCount(0);
  await expect(liveText(page)).toHaveText("MRN hidden");
  await expect(mrn).toBeFocused();

  await revealButton(page, "Date of birth").first().focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("[data-revealed]")).toHaveText(/1959/);
  await revealButton(page, "Medication").focus();
  await page.keyboard.press("Space");
  await expect(page.locator("[data-revealed]")).toHaveCount(2);
  await expect(page.locator("[data-revealed]").nth(1)).toHaveText("Calvexa 250 mg capsule");

  // Turning Privacy off and on again masks every revealed field.
  await privacyButton(page).click();
  await privacyButton(page).click();
  await expect(page.locator("[data-revealed]")).toHaveCount(0);
  await expectMasked(page);
});

test("Ctrl+. toggles from anywhere, including a text field and an open dialog; focus stays on the field", async ({ page }) => {
  await open(page);
  const notes = page.locator("#privacy-notes");
  await expect(async () => {
    await notes.focus();
    await page.keyboard.press("Control+.");
    await expect(privacyButton(page)).toHaveAttribute("aria-pressed", "true", { timeout: 1_000 });
  }).toPass({ timeout: 30_000 });
  await expect(revealButton(page, "Notes")).toBeFocused();
  await page.keyboard.press("Control+.");
  await expect(privacyButton(page)).toHaveAttribute("aria-pressed", "false");
  await expect(notes).toBeFocused();

  await page.getByRole("button", { name: "Open dialog" }).click();
  const dialog = page.getByRole("dialog", { name: "Cancel this draft?" });
  await expect(dialog).toContainText("Testcase, Rowan");
  await page.keyboard.press("Control+.");
  await expect(privacyButton(page)).toHaveAttribute("aria-pressed", "true");
  await expect(dialog).toBeVisible();
  await expect(dialog).not.toContainText("Testcase");
  await expect(dialog.getByRole("button", { name: "Patient name hidden, press to reveal" })).toBeVisible();
  expect(await page.evaluate(() => Boolean(document.activeElement?.closest("dialog")))).toBe(true);
});

test("stays on across client navigation, reloads and loading skeletons without a visible frame", async ({ page }) => {
  await watchForLeaks(page);
  await open(page);
  await turnOn(page);

  // A full page load that streams a loading skeleton first.
  await page.goto(`${URL}?delay=1500`);
  await expect(privacyButton(page)).toHaveAttribute("aria-pressed", "true");
  await page.waitForLoadState("networkidle");
  await expectMasked(page);

  // Client navigation to the prescribing specimen.
  await page.getByRole("link", { name: "prescribing specimen" }).click();
  await expect(page).toHaveURL(/\/dev\/prescribing/);
  await expect(revealButton(page, "Patient name")).toBeVisible();
  await expect(page.getByRole("main")).not.toContainText("Testcase");

  // Client navigation from the shell: the top-bar search (next/form) to the patient list specimen.
  const search = page.getByRole("searchbox", { name: /Search patients/ });
  await search.fill("Rowan");
  await search.press("Enter");
  await expect(page).toHaveURL(/\/dev\/shell\?view=clinician$/);
  await expect(privacyButton(page)).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("link", { name: "Patient name hidden" }).first()).toBeVisible();
  await expect(page.getByRole("main")).not.toContainText("Testcase");

  await page.reload();
  await page.waitForLoadState("networkidle");
  await expect(privacyButton(page)).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("main")).not.toContainText("Testcase");

  expect(await leaks(page)).toEqual([]);
});

test("turning on empties the search field and drops ?q= from the URL; turning off puts the query back", async ({ page }) => {
  await open(page, "/dev/shell?view=clinician&q=Rowan");
  const search = page.getByRole("searchbox", { name: /Search patients/ });
  await expect(search).toHaveValue("Rowan");
  const requests: string[] = [];
  page.on("request", (request) => {
    if (request.resourceType() === "document" || request.headers()["rsc"]) requests.push(request.url());
  });

  await turnOn(page);
  await expect(search).toHaveValue("");
  await expect(page).toHaveURL(/\/dev\/shell\?view=clinician$/);
  expect(await page.locator("body").ariaSnapshot()).not.toContain("Rowan");
  expect(requests, "stripping the query does not reload the page").toEqual([]);

  await privacyButton(page).click();
  await expect(page).toHaveURL(/\/dev\/shell\?view=clinician&q=Rowan$/);
  await expect(search).toHaveValue("Rowan");
  await expect(page.getByRole("link", { name: /Testcase, Rowan/ })).toBeVisible();

  // Unsubmitted text is cleared too, and is not restored.
  await search.fill("Testcase");
  await page.keyboard.press("Control+.");
  await expect(privacyButton(page)).toHaveAttribute("aria-pressed", "true");
  await expect(search).toHaveValue("");
  await privacyButton(page).click();
  await expect(search).toHaveValue("Rowan");
});

test("prescribing: auto-hide masks open dialogs in place and keeps the unsaved draft and typed reason", async ({ page }) => {
  await page.clock.install();
  await open(page, "/dev/prescribing?view=ready");
  const quantity = page.locator("#quantity");
  await quantity.fill("56");
  const dialog = page.getByRole("dialog", { name: "Cancel this draft?" });
  await page.getByRole("button", { name: "Cancel this draft" }).click();
  const reason = page.locator("#cancel-reason");
  await reason.fill("Duplicate order");

  await page.clock.fastForward(PRIVACY_IDLE_MS + 1_000);
  await expect(privacyButton(page)).toHaveAttribute("aria-pressed", "true");
  await expect(dialog).toBeVisible();
  const reasonMask = dialog.getByRole("button", { name: "Cancel reason hidden, press to reveal" });
  await expect(reasonMask).toBeVisible();
  expect(await dialog.ariaSnapshot()).not.toContain("Duplicate order");
  await reasonMask.click();
  await expect(reason).toHaveValue("Duplicate order");
  await expect(reason).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();

  // The draft form is masked in place and keeps the unsaved quantity.
  await expect(revealButton(page, "Quantity")).toBeVisible();
  expect(await page.getByRole("main").ariaSnapshot()).not.toContain("Testcase");
  await revealButton(page, "Quantity").click();
  await expect(quantity).toHaveValue("56");
  await expect(quantity).toBeFocused();

  // Label preview: the label text is masked; the simulated-label notice is not patient data.
  await page.getByRole("button", { name: "Preview label" }).click();
  const label = page.getByRole("dialog", { name: "Label preview" });
  await expect(label).toContainText("Simulated label. Synthetic data, not dispensed.");
  await expect(label).not.toContainText("Testcase");
  await expect(label.getByRole("button", { name: "Label text hidden, press to reveal" })).toBeVisible();
  await page.keyboard.press("Escape");

  await privacyButton(page).click();
  await expect(quantity).toHaveValue("56");
});

test("reduced motion: masking and revealing run no transition or animation", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await open(page);
  await turnOn(page);
  const mask = revealButton(page, "MRN").first();
  const longest = (el: Element) => Math.max(...getComputedStyle(el).transitionDuration.split(",").map(parseFloat));
  expect(await mask.evaluate(longest)).toBeLessThan(0.001);
  expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
  await mask.click();
  const revealed = page.locator("[data-revealed]");
  await expect(revealed).toHaveText("SYN-000101");
  expect(await revealed.evaluate(longest)).toBeLessThan(0.001);
  expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
});

test("signing out from the account menu drops the stored state and the sign-in page turns Privacy mode off", async ({ page }) => {
  await open(page);
  await turnOn(page);
  await page.getByRole("button", { name: /account menu/i }).click();
  await page.getByRole("menuitemradio", { name: "2 minutes" }).click();
  expect(await page.evaluate(() => sessionStorage.getItem("kestrel.privacy.idle"))).toBe("120000");
  await page.getByRole("button", { name: /account menu/i }).click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  expect(await page.evaluate(() => sessionStorage.getItem("kestrel.privacy"))).toBeNull();
  expect(await page.evaluate(() => sessionStorage.getItem("kestrel.privacy.idle"))).toBeNull();
  // The page stays masked until it is left.
  await expect(revealButton(page, "MRN").first()).toBeVisible();

  await open(page, "/dev/shell?view=login");
  expect(await page.evaluate(() => document.documentElement.getAttribute("data-privacy"))).toBeNull();
  await open(page);
  await expect(privacyButton(page)).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByRole("link", { name: /Testcase, Rowan/ })).toBeVisible();
});

for (const width of [1440, 390]) {
  test(`axe: values shown, masked and one revealed at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await open(page);
    for (const state of ["shown", "masked", "revealed"] as const) {
      if (state === "masked") await turnOn(page);
      if (state === "revealed") await revealButton(page, "MRN").first().click();
      const result = await new AxeBuilder({ page }).exclude("nextjs-portal").analyze();
      const blocking = result.violations
        .filter((v) => v.impact === "serious" || v.impact === "critical")
        .map((v) => `${v.impact} ${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
      const other = result.violations.filter((v) => v.impact !== "serious" && v.impact !== "critical").map((v) => `${v.impact} ${v.id}`);
      console.log(`axe privacy ${state} ${width}px: ${other.join(", ") || "no moderate or minor findings"}`);
      expect(blocking, `${state} at ${width}px`).toEqual([]);
    }
  });
}

test("the auto-hide delay comes from the account menu choice", async ({ page }) => {
  await page.clock.install();
  await open(page);
  await expect(async () => {
    await page.getByRole("button", { name: /account menu/i }).click();
    await expect(page.getByRole("menu", { name: "Account" })).toBeVisible({ timeout: 1_000 });
  }).toPass({ timeout: 30_000 });
  await expect(page.getByRole("menuitemradio", { name: "1 minute" })).toHaveAttribute("aria-checked", "true");
  await page.getByRole("menuitemradio", { name: "30 seconds" }).click();
  await expect(page.getByRole("menu", { name: "Account" })).toBeHidden();
  expect(await page.evaluate(() => sessionStorage.getItem("kestrel.privacy.idle"))).toBe("30000");

  await page.clock.fastForward(29_000);
  await expect(privacyButton(page)).toHaveAttribute("aria-pressed", "false");
  await page.clock.fastForward(2_000);
  await expect(privacyButton(page)).toHaveAttribute("aria-pressed", "true");

  // The choice survives a reload in the same tab.
  await page.reload();
  await page.getByRole("button", { name: /account menu/i }).click();
  await expect(page.getByRole("menuitemradio", { name: "30 seconds" })).toHaveAttribute("aria-checked", "true");
});