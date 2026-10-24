import { expect, test, type Locator, type Page } from "@playwright/test";

// Toast specimen (/dev/toast): visual-only success text over the top bar; callers announce outcomes.

const region = (page: Page) => page.locator("[data-toast-region]");
const toasts = (page: Page) => page.locator("[data-toast]");
const show = (page: Page, message: string) => page.getByRole("button", { name: `Show “${message}”` });

async function open(page: Page, query = ""): Promise<void> {
  await page.goto(`/dev/toast${query}`);
  await page.waitForLoadState("networkidle");
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
}

/** Clicks a specimen trigger until hydration has attached the handler. */
async function trigger(page: Page, message: string): Promise<void> {
  await expect(async () => {
    await show(page, message).click();
    await expect(toasts(page).filter({ hasText: message })).toHaveCount(1, { timeout: 1_000 });
  }).toPass({ timeout: 30_000 });
}

async function tokenColor(page: Page, token: string): Promise<string> {
  return page.evaluate((name) => {
    const probe = document.createElement("span");
    probe.style.color = `var(--color-${name})`;
    document.body.append(probe);
    const colour = getComputedStyle(probe).color;
    probe.remove();
    return colour;
  }, token);
}

type Box = { x: number; y: number; width: number; height: number };
const overlaps = (a: Box, b: Box) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
const box = async (locator: Locator) => (await locator.boundingBox())!;

test("visual only: not a live region, the dismiss name carries the message, and the trigger keeps focus", async ({ page }) => {
  await open(page);
  await trigger(page, "Draft saved.");
  await expect(region(page)).toHaveCount(1);
  const live = "[aria-live], [role=status], [role=alert], [role=log]";
  expect(await region(page).evaluate((el, sel) => el.closest(sel) === null && el.querySelector(sel) === null, live)).toBe(true);
  await expect(page.getByRole("status").filter({ hasText: "Draft saved." })).toHaveCount(0);
  await expect(show(page, "Draft saved.")).toBeFocused();
  await expect(toasts(page).getByRole("button", { name: "Dismiss: Draft saved", exact: true })).toBeVisible();
});

const OUTCOMES = [
  { action: "Save draft", toast: "Draft saved.", announced: /Draft saved/ },
  { action: "Acknowledge", toast: "Advisory alert acknowledged.", announced: /acknowledged/i },
  { action: "Sign", toast: "Prescription signed (simulated).", announced: /Prescription signed/ },
  { action: "Cancel", toast: "Draft cancelled.", announced: /Draft cancelled/ },
];

test("one announcer: for each of the four actions exactly one live region carries the outcome", async ({ page }) => {
  await open(page);
  for (const { action, toast, announced } of OUTCOMES) {
    await expect(async () => {
      await page.getByRole("button", { name: `Simulate ${action}`, exact: true }).click();
      await expect(toasts(page).filter({ hasText: toast })).toHaveCount(1, { timeout: 1_000 });
    }).toPass({ timeout: 30_000 });
    const carriers = await page.evaluate(
      ({ source, flags }) => {
        const pattern = new RegExp(source, flags);
        const live = "[role=status], [role=alert], [role=log], [aria-live]:not([aria-live=off])";
        return [...document.querySelectorAll(live)]
          .filter((el) => pattern.test(el.textContent ?? "") && !el.parentElement?.closest(live))
          .map((el) => el.hasAttribute("data-toast-region") || el.closest("[data-toast-region]") !== null);
      },
      { source: announced.source, flags: announced.flags },
    );
    expect(carriers, `${action}: one live region, and it is not the toast`).toEqual([false]);
    await expect(toasts(page).getByRole("button", { name: `Dismiss: ${toast.replace(/\.$/, "")}`, exact: true })).toBeVisible();
    await toasts(page).getByRole("button", { name: `Dismiss: ${toast.replace(/\.$/, "")}`, exact: true }).click();
  }
});

test("token colours: inverse surface, on-inverse text and icons, never the success green", async ({ page }) => {
  await open(page, "?show=one");
  const toast = toasts(page).first();
  await expect(toast).toBeVisible();
  const inverse = await tokenColor(page, "inverse");
  const onInverse = await tokenColor(page, "on-inverse");
  const colours = await toast.evaluate((el) => ({
    bg: getComputedStyle(el).backgroundColor,
    text: getComputedStyle(el.querySelector("p")!).color,
    icons: [...el.querySelectorAll("svg")].map((svg) => getComputedStyle(svg).color),
  }));
  expect(colours.bg).toBe(inverse);
  expect(colours.text).toBe(onInverse);
  expect(colours.icons).toEqual([onInverse, onInverse]);
  expect(colours.icons).not.toContain(await tokenColor(page, "ok"));
});

test("keyboard: Shift+Tab from the content reaches the dismiss button, focus pauses the timer, Escape dismisses and returns focus", async ({ page }) => {
  await open(page);
  await trigger(page, "Draft saved.");
  // The toast lives in the top bar, so it comes just before the main content in tab order.
  const before = show(page, "Draft saved.");
  await before.focus();
  const dismiss = toasts(page).getByRole("button", { name: "Dismiss: Draft saved" });
  for (let i = 0; i < 10 && !(await dismiss.evaluate((el) => el === document.activeElement)); i++) {
    await page.keyboard.press("Shift+Tab");
  }
  await expect(dismiss).toBeFocused();
  const outline = await dismiss.evaluate((el) => ({ colour: getComputedStyle(el).outlineColor, style: getComputedStyle(el).outlineStyle }));
  expect(outline).toEqual({ colour: await tokenColor(page, "on-inverse"), style: "solid" });

  await page.waitForTimeout(7000);
  await expect(toasts(page)).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(toasts(page)).toHaveCount(0);
  await expect(before).toBeFocused();
});

test("auto-dismisses after six seconds, and hovering pauses it", async ({ page }) => {
  await open(page);
  await trigger(page, "Draft saved.");
  await page.waitForTimeout(4500);
  await expect(toasts(page)).toHaveCount(1);
  await expect(toasts(page)).toHaveCount(0, { timeout: 3000 });

  await trigger(page, "Draft cancelled.");
  await toasts(page).first().hover();
  await page.waitForTimeout(7000);
  await expect(toasts(page)).toHaveCount(1);
  await page.mouse.move(5, 800);
  await expect(toasts(page)).toHaveCount(0, { timeout: 8000 });
});

test("three at most as a deck: the newest in front, the others inert behind; the fourth waits; duplicates are dropped", async ({ page }) => {
  await open(page, "?show=four");
  await expect(toasts(page)).toHaveCount(3);
  await expect(toasts(page)).toHaveText(["Draft saved.", "Advisory alert acknowledged.", "Prescription signed (simulated)."]);
  expect(await toasts(page).evaluateAll((els) => els.map((el) => [el.getAttribute("data-toast-depth"), el.hasAttribute("inert")]))).toEqual([
    ["2", true],
    ["1", true],
    ["0", false],
  ]);
  await show(page, "Draft saved.").click();
  await expect(toasts(page)).toHaveCount(3);
  await toasts(page).last().getByRole("button", { name: "Dismiss: Prescription signed (simulated)" }).click();
  await expect(toasts(page)).toHaveText(["Draft saved.", "Advisory alert acknowledged.", "Draft cancelled."]);
});

test("waits while a native dialog is open, then shows", async ({ page }) => {
  await open(page, "?show=dialog");
  const dialog = page.getByRole("dialog", { name: "Specimen dialog" });
  await expect(dialog).toBeVisible();
  await page.waitForTimeout(1000);
  await expect(toasts(page)).toHaveCount(0);
  await dialog.getByRole("button", { name: "Close" }).click();
  await expect(dialog).toBeHidden();
  await expect(toasts(page)).toHaveText(["Draft saved."]);
});

test("motion: a short entrance with motion allowed, none under reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await open(page, "?show=one");
  expect(await toasts(page).first().evaluate((el) => getComputedStyle(el).animationName)).toBe("toast-in");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await open(page, "?show=one");
  expect(await toasts(page).first().evaluate((el) => getComputedStyle(el).animationName)).toBe("none");
});

/** The whole deck, including the offset of the cards behind the front one. */
async function deckBox(page: Page): Promise<Box> {
  const boxes = await toasts(page).evaluateAll((els) => els.map((el) => el.getBoundingClientRect().toJSON() as DOMRect));
  const top = Math.min(...boxes.map((b) => b.y));
  const left = Math.min(...boxes.map((b) => b.x));
  return {
    x: left,
    y: top,
    width: Math.max(...boxes.map((b) => b.x + b.width)) - left,
    height: Math.max(...boxes.map((b) => b.y + b.height)) - top,
  };
}

for (const width of [1440, 1024, 390]) {
  test(`anchored in the top bar at ${width}px: below the synthetic banner, no layout shift, never over Sign or Save`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await open(page);
    const heading = page.getByRole("heading", { level: 1 });
    const actions = page.locator("[data-specimen-actions]");
    const before = [await box(heading), await box(actions)];
    await trigger(page, "Prescription signed (simulated).");
    expect([await box(heading), await box(actions)]).toEqual(before);
    await expect(page.locator("[data-topbar] [data-toast-region]")).toHaveCount(1);

    // Top of the page: the bar sits below the synthetic-data banner, and so does the toast.
    const banner = await box(page.getByRole("note"));
    expect(overlaps(await box(toasts(page).first()), banner)).toBe(false);
    expect((await box(toasts(page).first())).y).toBeGreaterThanOrEqual(banner.y + banner.height);

    // Scroll the actions to just under the top bar, the closest they can get to the toast.
    await page.addStyleTag({ content: "main { min-height: 300vh; }" });
    await actions.evaluate((el) => el.scrollIntoView({ block: "start" }));
    const toast = await box(toasts(page).first());
    const bar = await box(page.locator("[data-topbar]"));
    expect(bar.y).toBe(0);
    expect(toast.y).toBeGreaterThanOrEqual(bar.y);
    expect(toast.y + toast.height).toBeLessThanOrEqual(bar.y + bar.height);
    expect(toast.x + toast.width).toBeLessThanOrEqual(width);
    const rail = await box(page.getByRole("navigation", { name: "Main" }));
    expect(toast.x).toBeGreaterThanOrEqual(rail.x + rail.width);
    for (const name of ["Sign prescription (simulated)", "Save draft"]) {
      expect(overlaps(toast, await box(page.getByRole("button", { name, exact: true })))).toBe(false);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  });

  test(`a deck of three stays inside the top bar at ${width}px, with and without Today's queue`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    for (const query of ["?show=four", "?show=four&queue=0"]) {
      await open(page, query);
      await expect(toasts(page)).toHaveCount(3);
      await page.addStyleTag({ content: "main { min-height: 300vh; }" });
      await page.evaluate(() => window.scrollTo(0, 400));
      await expect.poll(async () => (await box(page.locator("[data-topbar]"))).y).toBe(0);
      const bar = await box(page.locator("[data-topbar]"));
      const deck = await deckBox(page);
      expect(deck.y + deck.height, query).toBeLessThanOrEqual(bar.y + bar.height);
      // The newest toast is the one painted on top, so its text is the one that can be read.
      const onTop = await toasts(page)
        .last()
        .evaluate((el) => {
          const r = el.getBoundingClientRect();
          return el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
        });
      expect(onTop, query).toBe(true);
    }
  });
}

test("Privacy mode: the toast text stays readable and holds no masked patient value", async ({ page }) => {
  await open(page);
  await expect(async () => {
    await page.getByTestId("privacy-toggle").click();
    await expect(page.getByTestId("privacy-toggle")).toHaveAttribute("aria-pressed", "true", { timeout: 1_000 });
  }).toPass({ timeout: 30_000 });
  await expect(page.getByRole("button", { name: "Patient name hidden, press to reveal" })).toBeVisible();
  await trigger(page, "Draft saved.");
  await expect(toasts(page).first().locator("p")).toHaveText("Draft saved.");
  await expect(toasts(page).first()).not.toContainText("•");
});
