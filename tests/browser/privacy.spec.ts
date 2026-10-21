import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { PRIVACY_IDLE_MS } from "../../src/features/privacy/config";
import { hideDevOverlay, reviewScreenshot } from "./support";

// Privacy mode on the /dev/privacy specimen (and navigation to other specimens). Content must be
// unreadable while it is on: hidden, inert, out of the accessibility tree and out of selections.

const URL = "/dev/privacy";
const privacyButton = (page: Page) => page.getByRole("button", { name: "Privacy" });
const showButton = (page: Page) => page.getByRole("button", { name: "Show content" });
const liveText = (page: Page) => page.locator("header [aria-live=polite]");
/** The sticky top bar inside the `display: contents` header landmark. */
const topBar = (page: Page) => page.getByRole("banner").locator(":scope > div");

/**
 * Records every animation frame (before paint) in which Privacy mode is stored as on but content
 * in the masked area is visible, and every moment the <html> attribute is missing.
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
        if (document.querySelector("[data-privacy-content]") && document.documentElement.getAttribute("data-privacy") !== "on") {
          w.__leaks.push(`attribute missing on ${location.pathname}${location.search}`);
        }
        for (const el of document.querySelectorAll("[data-privacy-content]")) {
          if (getComputedStyle(el).visibility !== "hidden") w.__leaks.push(`visible content on ${location.pathname}${location.search}`);
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

async function focusInsideContent(page: Page): Promise<boolean> {
  return page.evaluate(() => Boolean(document.activeElement?.closest("[data-privacy-content]")));
}

for (const width of [1440, 1024, 390]) {
  test(`button toggles, content is masked and focus hands over both ways at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await open(page);
    const content = page.locator("[data-privacy-content]");
    const before = { header: await topBar(page).boundingBox(), content: await content.boundingBox() };
    expect(before.header).not.toBeNull();

    await expect(privacyButton(page)).toHaveAttribute("aria-pressed", "false");
    await expect(page.getByRole("link", { name: /Testcase, Rowan/ })).toBeVisible();
    const label = privacyButton(page).getByText("Privacy");
    if (width < 820) {
      expect(await label.evaluate((el) => getComputedStyle(el).position)).toBe("absolute");
    } else {
      await expect(label).toBeVisible();
    }

    await turnOn(page);
    await expect(showButton(page)).toBeFocused();
    await expect(liveText(page)).toHaveText("Content hidden");
    await expect(page.getByRole("heading", { name: "Content hidden" })).toBeVisible();
    await expect(content).toHaveAttribute("inert", "");
    await expect(content).toHaveAttribute("aria-hidden", "true");
    expect(await content.evaluate((el) => getComputedStyle(el).visibility)).toBe("hidden");
    await expect(page.getByRole("link", { name: /Testcase, Rowan/ })).toHaveCount(0);
    await expect(page.getByRole("textbox", { name: "Notes" })).toHaveCount(0);

    // Not in the accessibility tree, not focusable, not selectable.
    const tree = await page.locator("body").ariaSnapshot();
    expect(tree).not.toContain("Testcase");
    expect(tree).not.toContain("SYN-000101");
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press("Tab");
      expect(await focusInsideContent(page)).toBe(false);
    }
    const selected = await page.evaluate(() => {
      getSelection()?.selectAllChildren(document.body);
      const text = getSelection()?.toString() ?? "";
      getSelection()?.removeAllRanges();
      return text;
    });
    expect(selected).not.toContain("Testcase");
    expect(selected).not.toContain("SYN-0001");

    // Zero layout shift: the top bar and the content box do not move.
    expect(await topBar(page).boundingBox()).toEqual(before.header);
    expect(await content.boundingBox()).toEqual(before.content);
    await reviewScreenshot(page, "privacy", `on-${width}`);

    await showButton(page).click();
    await expect(privacyButton(page)).toBeFocused();
    await expect(privacyButton(page)).toHaveAttribute("aria-pressed", "false");
    await expect(liveText(page)).toHaveText("Content shown");
    await expect(page.getByRole("link", { name: /Testcase, Rowan/ })).toBeVisible();
    await expect(content).not.toHaveAttribute("inert", "");
  });
}

test("Ctrl+. toggles from anywhere, including a text field, and is ignored while a dialog is open", async ({ page }) => {
  await open(page);
  const notes = page.getByRole("textbox", { name: "Notes" });
  await expect(async () => {
    await notes.focus();
    await page.keyboard.press("Control+.");
    await expect(privacyButton(page)).toHaveAttribute("aria-pressed", "true", { timeout: 1_000 });
  }).toPass({ timeout: 30_000 });
  await expect(showButton(page)).toBeFocused();
  await page.keyboard.press("Control+.");
  await expect(privacyButton(page)).toHaveAttribute("aria-pressed", "false");
  await expect(privacyButton(page)).toBeFocused();

  await page.getByRole("button", { name: "Open dialog" }).click();
  const dialog = page.getByRole("dialog", { name: "Cancel this draft?" });
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Control+.");
  await expect(privacyButton(page)).toHaveAttribute("aria-pressed", "false");
  await expect(dialog).toBeVisible();
  expect(await page.evaluate(() => Boolean(document.activeElement?.closest("dialog")))).toBe(true);
});

test("stays on across client navigation, reloads and loading skeletons without a visible frame", async ({ page }) => {
  await watchForLeaks(page);
  await open(page);
  await turnOn(page);

  // A full page load that streams a loading skeleton first.
  await page.goto(`${URL}?delay=1500`);
  await expect(showButton(page)).toBeVisible();
  await expect(privacyButton(page)).toHaveAttribute("aria-pressed", "true");
  await page.waitForLoadState("networkidle");

  // Client navigation from the shell: the top-bar search (next/form) to the patient list specimen.
  const search = page.getByRole("searchbox", { name: /Search patients/ });
  await search.fill("Rowan");
  await search.press("Enter");
  await expect(page).toHaveURL(/\/dev\/shell\?view=clinician$/);
  await expect(showButton(page)).toBeVisible();
  await expect(privacyButton(page)).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("main").getByRole("heading")).toHaveCount(0);
  await expect(page.getByRole("link", { name: /Testcase, Rowan/ })).toHaveCount(0);

  await page.reload();
  await page.waitForLoadState("networkidle");
  await expect(privacyButton(page)).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("main").getByRole("heading")).toHaveCount(0);

  expect(await leaks(page)).toEqual([]);
});

test("turning on empties the search field and drops ?q= from the URL; Show content puts the query back", async ({ page }) => {
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

  await showButton(page).click();
  await expect(page).toHaveURL(/\/dev\/shell\?view=clinician&q=Rowan$/);
  await expect(search).toHaveValue("Rowan");
  await expect(page.getByRole("link", { name: /Testcase, Rowan/ })).toBeVisible();

  // Unsubmitted text is cleared too, and is not restored.
  await search.fill("Testcase");
  await page.keyboard.press("Control+.");
  await expect(privacyButton(page)).toHaveAttribute("aria-pressed", "true");
  await expect(search).toHaveValue("");
  await showButton(page).click();
  await expect(search).toHaveValue("Rowan");
});

test("auto-hide closing a prescribing dialog keeps the unsaved draft and the typed cancel reason", async ({ page }) => {
  await page.clock.install();
  await open(page, "/dev/prescribing?view=ready");
  const quantity = page.getByLabel("Quantity");
  await quantity.fill("56");
  const trigger = page.getByRole("button", { name: "Cancel this draft" });
  const dialog = page.getByRole("dialog", { name: "Cancel this draft?" });
  await trigger.click();
  await dialog.getByLabel("Reason (optional)").fill("Duplicate order");

  await page.clock.fastForward(PRIVACY_IDLE_MS + 1_000);
  await expect(dialog).toBeHidden();
  await expect(privacyButton(page)).toHaveAttribute("aria-pressed", "true");
  await expect(showButton(page)).toBeFocused();

  await showButton(page).click();
  await expect(quantity).toHaveValue("56");
  await expect(page.getByRole("button", { name: "Cancel this draft" })).toBeVisible();
  await trigger.click();
  await expect(dialog.getByLabel("Reason (optional)")).toHaveValue("Duplicate order");
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "Preview label" }).click();
  await expect(page.getByRole("dialog", { name: "Label preview" })).toBeVisible();
  await page.clock.fastForward(PRIVACY_IDLE_MS + 1_000);
  await expect(page.getByRole("dialog", { name: "Label preview" })).toBeHidden();
  await showButton(page).click();
  await expect(quantity).toHaveValue("56");
});

test.describe("auto-hide", () => {
  test("hides after the idle period, announces it and moves focus to Show content", async ({ page }) => {
    await page.clock.install();
    await open(page);
    await expect(privacyButton(page)).toHaveAttribute("aria-pressed", "false");
    await page.clock.fastForward(PRIVACY_IDLE_MS - 5_000);
    await expect(privacyButton(page)).toHaveAttribute("aria-pressed", "false");
    await page.clock.fastForward(6_000);
    await expect(privacyButton(page)).toHaveAttribute("aria-pressed", "true");
    await expect(showButton(page)).toBeFocused();
    await expect(liveText(page)).toHaveText("Content hidden");
  });

  test("does not hide while typing in the notes field; hides a full period after the last keystroke", async ({ page }) => {
    await page.clock.install();
    await open(page);
    const notes = page.getByRole("textbox", { name: "Notes" });
    await notes.click();
    for (let i = 0; i < 6; i++) {
      await page.clock.fastForward(PRIVACY_IDLE_MS / 3);
      await page.keyboard.type("x");
    }
    await expect(privacyButton(page)).toHaveAttribute("aria-pressed", "false");
    await page.clock.fastForward(PRIVACY_IDLE_MS - 2_000);
    await expect(privacyButton(page)).toHaveAttribute("aria-pressed", "false");
    await page.clock.fastForward(3_000);
    await expect(privacyButton(page)).toHaveAttribute("aria-pressed", "true");

    await showButton(page).click();
    await expect(page.getByRole("textbox", { name: "Notes" })).toHaveValue(/xxxxxx$/);
  });
});

test("reduced motion: the overlay card does not fade in", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await open(page);
  await turnOn(page);
  const card = page.locator("[data-privacy-overlay] > div");
  expect(await card.evaluate((el) => getComputedStyle(el).animationName)).toBe("none");

  await page.emulateMedia({ reducedMotion: "no-preference" });
  await showButton(page).click();
  await privacyButton(page).click();
  expect(await card.evaluate((el) => getComputedStyle(el).animationName)).toBe("fade-up");
});

test("signing out drops the stored state and the sign-in page turns Privacy mode off", async ({ page }) => {
  await open(page);
  await turnOn(page);
  await page.getByRole("button", { name: "Sign out" }).click();
  expect(await page.evaluate(() => sessionStorage.getItem("kestrel.privacy"))).toBeNull();
  // The page stays masked until it is left.
  await expect(showButton(page)).toBeVisible();

  await open(page, "/dev/shell?view=login");
  expect(await page.evaluate(() => document.documentElement.getAttribute("data-privacy"))).toBeNull();
  await open(page);
  await expect(privacyButton(page)).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByRole("link", { name: /Testcase, Rowan/ })).toBeVisible();
});

for (const width of [1440, 390]) {
  test(`axe: overlay shown and hidden at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await open(page);
    for (const state of ["hidden", "shown"] as const) {
      if (state === "shown") {
        await turnOn(page);
        // Scan the settled card, not a frame of its fade-in.
        await page
          .locator("[data-privacy-overlay] > div")
          .evaluate((el) => Promise.all(el.getAnimations({ subtree: true }).map((a) => a.finished)));
      }
      const result = await new AxeBuilder({ page }).exclude("nextjs-portal").analyze();
      const blocking = result.violations
        .filter((v) => v.impact === "serious" || v.impact === "critical")
        .map((v) => `${v.impact} ${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
      const other = result.violations.filter((v) => v.impact !== "serious" && v.impact !== "critical").map((v) => `${v.impact} ${v.id}`);
      console.log(`axe privacy overlay ${state} ${width}px: ${other.join(", ") || "no moderate or minor findings"}`);
      expect(blocking, `overlay ${state} at ${width}px`).toEqual([]);
    }
  });
}
