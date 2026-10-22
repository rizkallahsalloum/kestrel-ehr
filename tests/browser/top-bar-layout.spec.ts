import { expect, test, type Page } from "@playwright/test";
import { hideDevOverlay, reviewPath } from "./support";

// Phase 8e: queue position on the search row, fluid page width, Privacy label gap, account menu
// trigger and button hover/pressed states. Runs on the /dev specimens.

const privacy = (page: Page) => page.getByTestId("privacy-toggle");
const trigger = (page: Page) => page.getByRole("button", { name: /account menu/i });

async function open(page: Page, url: string): Promise<void> {
  await page.goto(url);
  await page.waitForLoadState("networkidle");
  await hideDevOverlay(page);
}

async function setPrivacy(page: Page, on: boolean): Promise<void> {
  await expect(async () => {
    if ((await privacy(page).getAttribute("aria-pressed")) !== String(on)) await privacy(page).click();
    await expect(privacy(page)).toHaveAttribute("aria-pressed", String(on), { timeout: 1_000 });
  }).toPass({ timeout: 30_000 });
}

/** Six chips (no "View all") inline from 2390px: `--breakpoint-queue-inline-6` in globals.css. */
const SIX_INLINE_AT = 2390;

for (const width of [1280, 1440, 1920, 2389, 2390, 2560]) {
  test(`six queue chips at ${width}px: ${width >= SIX_INLINE_AT ? "one row with the search" : "own row, wrapped"}, Privacy off and on, no shift`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await open(page, "/dev/chart?view=blocking&queue=6");
    const measure = () =>
      page.evaluate(() => {
        const bar = document.querySelector<HTMLElement>("[data-topbar]")!;
        const r = (el: Element) => el.getBoundingClientRect();
        const nav = bar.querySelector("nav[data-queue]")!;
        const items = [...nav.querySelectorAll("li")].map(r);
        const probe = document.createElement("div");
        probe.style.height = "var(--topbar-height)";
        document.body.append(probe);
        const tokenHeight = probe.getBoundingClientRect().height;
        probe.remove();
        const chip = document.createElement("div");
        chip.style.width = "var(--spacing-queue-chip)";
        document.body.append(chip);
        const chipWidth = chip.getBoundingClientRect().width;
        chip.remove();
        return {
          barHeight: r(bar).height,
          tokenHeight,
          chipWidth,
          pageOverflow: document.documentElement.scrollWidth - window.innerWidth,
          search: r(bar.querySelector("[role=search]")!),
          controls: r(bar.querySelector(".area-controls")!),
          nav: r(nav),
          itemTops: [...new Set(items.map((i) => Math.round(i.top)))],
          itemWidths: items.map((i) => Math.round(i.width * 10) / 10),
          boxes: [nav, ...nav.querySelectorAll("[data-queue-item]"), bar].map((el) => {
            const b = r(el);
            return `${b.x.toFixed(2)},${b.y.toFixed(2)} ${b.width.toFixed(2)}x${b.height.toFixed(2)}`;
          }),
        };
      });
    const before = await measure();
    expect(before.pageOverflow).toBeLessThanOrEqual(0);
    expect(Math.abs(before.barHeight - before.tokenHeight)).toBeLessThanOrEqual(0.5);
    if (width >= SIX_INLINE_AT) {
      // Same row, between the search and the controls, one line of full-width chips.
      expect(before.nav.left).toBeGreaterThanOrEqual(before.search.right);
      expect(before.nav.right).toBeLessThanOrEqual(before.controls.left + 0.5);
      expect(before.nav.top).toBeLessThan(before.controls.bottom);
      expect(before.itemTops).toHaveLength(1);
      for (const w of before.itemWidths) expect(w).toBeCloseTo(before.chipWidth, 0);
    } else {
      expect(before.nav.top).toBeGreaterThanOrEqual(before.controls.bottom);
      expect(before.itemTops).toHaveLength(Math.ceil(6 / 5));
    }
    await page.screenshot({ path: reviewPath("top-bar", `six-${width}-shown.png`), clip: { x: 0, y: 0, width, height: 240 } });
    await setPrivacy(page, true);
    const masked = await measure();
    expect(masked.boxes, "no layout shift with Privacy on").toEqual(before.boxes);
    await page.screenshot({ path: reviewPath("top-bar", `six-${width}-masked.png`), clip: { x: 0, y: 0, width, height: 240 } });
  });
}

for (const width of [2560, 1920, 1440, 1181, 1180, 761, 760]) {
  test(`page width at ${width}px: rail shown, main content edges match the top bar's, chart columns`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await open(page, "/dev/chart?view=blocking");
    const layout = await page.evaluate(() => {
      const r = (el: Element) => el.getBoundingClientRect();
      const token = (value: string) => {
        const probe = document.createElement("div");
        probe.style.width = value;
        document.body.append(probe);
        const w = probe.getBoundingClientRect().width;
        probe.remove();
        return w;
      };
      const grid = document.querySelector('main [class*="grid-cols-workspace"]')!;
      const gs = getComputedStyle(grid);
      const bar = document.querySelector("[data-topbar]")!;
      const bs = getComputedStyle(bar);
      return {
        grid: r(grid),
        barContent: { left: r(bar).left + parseFloat(bs.paddingLeft), right: r(bar).right - parseFloat(bs.paddingRight) },
        search: r(bar.querySelector("[role=search]")!),
        controls: r(bar.querySelector(".area-controls")!),
        rail: r(document.querySelector("aside")!),
        railVisible: getComputedStyle(document.querySelector("aside")!).visibility,
        bar: r(document.querySelector("[data-topbar]")!),
        main: r(document.querySelector("main")!),
        mainPad: parseFloat(getComputedStyle(document.querySelector("main")!).paddingLeft),
        context: token("var(--width-context)"),
        gapToken: token("var(--spacing-lg)"),
        columns: gs.gridTemplateColumns.split(" "),
        gap: parseFloat(gs.columnGap),
        overflow: document.documentElement.scrollWidth - window.innerWidth,
      };
    });
    expect(layout.overflow).toBeLessThanOrEqual(0);
    // The rail is there at every width, full height, at the left edge.
    expect(layout.railVisible).toBe("visible");
    expect(layout.rail.x).toBe(0);
    expect(layout.rail.width).toBeGreaterThan(0);
    expect(layout.rail.height).toBeCloseTo(900, 0);
    // The top bar spans the whole content column.
    expect(layout.bar.left).toBeCloseTo(layout.rail.right, 0);
    expect(layout.bar.right).toBeCloseTo(width, 0);
    // Main spans the same column as the top bar, with the same padding: the chart's outer edges line
    // up with the bar's content edges (the search on the left, the account menu on the right).
    expect(layout.main.left).toBeCloseTo(layout.bar.left, 0);
    expect(layout.main.right).toBeCloseTo(layout.bar.right, 0);
    expect(Math.abs(layout.grid.left - layout.barContent.left), "left edge").toBeLessThanOrEqual(1);
    expect(Math.abs(layout.grid.right - layout.barContent.right), "right edge").toBeLessThanOrEqual(1);
    expect(Math.abs(layout.grid.left - layout.search.left), "chart and search left edges").toBeLessThanOrEqual(1);
    expect(Math.abs(layout.grid.right - layout.controls.right), "chart and controls right edges").toBeLessThanOrEqual(1);
    // Chart: flexible main column plus the fixed context column from 1181px; one column at 1180 and below.
    if (width >= 1181) {
      expect(layout.columns).toHaveLength(2);
      expect(parseFloat(layout.columns[1]!)).toBeCloseTo(layout.context, 0);
      expect(parseFloat(layout.columns[0]!)).toBeCloseTo(layout.main.width - 2 * layout.mainPad - layout.context - layout.gap, 0);
    } else {
      expect(layout.columns).toHaveLength(1);
    }
    expect(layout.gap).toBe(layout.gapToken);
    await page.screenshot({ path: reviewPath("page-width", `chart-${width}.png`), caret: "initial" });
  });
}

for (const width of [820, 1440]) {
  test(`Privacy button at ${width}px: label xs from the icon, off and on, same box`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await open(page, "/dev/chart?view=blocking");
    const measure = () =>
      privacy(page).evaluate((button) => {
        const icon = button.querySelector("svg")!.getBoundingClientRect();
        const label = [...button.querySelectorAll(":scope > span > span")].find((s) => !s.classList.contains("invisible"))!;
        const probe = document.createElement("div");
        probe.style.width = "var(--spacing-xs)";
        document.body.append(probe);
        const xs = probe.getBoundingClientRect().width;
        probe.remove();
        const b = button.getBoundingClientRect();
        return { gap: label.getBoundingClientRect().left - icon.right, xs, text: label.textContent, box: [b.x, b.y, b.width, b.height] };
      });
    const off = await measure();
    expect(off.text).toBe("Privacy");
    expect(off.gap).toBeCloseTo(off.xs, 0);
    await setPrivacy(page, true);
    const on = await measure();
    expect(on.text).toBe("Privacy on");
    expect(on.gap).toBeCloseTo(on.xs, 0);
    expect(on.box, "no layout shift on toggle").toEqual(off.box);
    await page.screenshot({ path: reviewPath("top-bar", `privacy-gap-${width}.png`), clip: { x: Math.max(0, width - 700), y: 0, width: Math.min(700, width), height: 120 } });
  });
}

test("Privacy button below 820px: icon only, the accessible name stays", async ({ page }) => {
  await page.setViewportSize({ width: 819, height: 900 });
  await open(page, "/dev/chart?view=blocking");
  for (const on of [false, true]) {
    await setPrivacy(page, on);
    const labelWidth = await privacy(page).evaluate((el) => el.querySelector(":scope > span")!.getBoundingClientRect().width);
    expect(labelWidth).toBeLessThanOrEqual(1);
    await expect(privacy(page)).toHaveAccessibleName(on ? "Privacy on" : "Privacy");
  }
});

test("account menu trigger: avatar and chevron only, at least 40px, named after the user; name, role and clinic are plain text", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await open(page, "/dev/chart?view=blocking");
  await expect(trigger(page)).toHaveAccessibleName("Account menu, Dr. Demo Clinician");
  const box = (await trigger(page).boundingBox())!;
  expect(box.width).toBeGreaterThanOrEqual(40);
  expect(box.height).toBeGreaterThanOrEqual(40);
  // Only the avatar and the chevron inside the button.
  expect(await trigger(page).evaluate((el) => [...el.children].map((c) => c.tagName))).toEqual(["SPAN", "svg"]);
  // The initials are drawn as generated content of the decorative avatar, so they are not part of the name.
  const initials = trigger(page).locator("[data-initials]");
  expect(await initials.evaluate((el) => getComputedStyle(el, "::before").content)).toBe('"DC"');
  const user = page.getByTestId("current-user");
  await expect(user).toBeVisible();
  await expect(user).toHaveText("Dr. Demo Clinician, Clinician · Cedar Park");
  expect(await user.evaluate((el) => Boolean(el.closest("button, a, [role=button]")))).toBe(false);
  // Clicking the name does nothing.
  await user.click();
  await expect(page.getByRole("menu", { name: "Account" })).toBeHidden();
  await expect(trigger(page)).toHaveAttribute("aria-expanded", "false");

  // Below 1180px the name and role are visually hidden; the trigger stays the same size.
  await page.setViewportSize({ width: 1179, height: 900 });
  expect((await user.boundingBox())?.width ?? 0).toBeLessThanOrEqual(1);
  const small = (await trigger(page).boundingBox())!;
  expect(small.width).toBeGreaterThanOrEqual(40);
  expect(small.height).toBeGreaterThanOrEqual(40);
  await page.screenshot({ path: reviewPath("top-bar", "account-trigger-1179.png"), clip: { x: 479, y: 0, width: 700, height: 120 } });
});

const style = (page: Page, selector: string) =>
  page.locator(selector).first().evaluate((el) => {
    const cs = getComputedStyle(el);
    return {
      bg: cs.backgroundColor,
      shadow: cs.boxShadow,
      color: cs.color,
      underline: cs.textDecorationLine,
      property: cs.transitionProperty,
      duration: cs.transitionDuration,
    };
  });

/** A computed box-shadow that paints something (Tailwind composes transparent layers for "none"). */
const shows = (shadow: string) => shadow !== "none" && !/^(rgba\(0, 0, 0, 0\) 0px 0px 0px 0px(, )?)+$/.test(shadow);

const LIVE = (variant: string) => `[data-testid=button-states-${variant}] button:not(:disabled)`;
const DISABLED = (variant: string) => `[data-testid=button-states-${variant}] button:disabled`;

test("buttons: visible hover (lighter fill and shadow) and darker pressed state on every variant, links included", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await open(page, "/dev/components");
  for (const selector of ["[data-testid=button-link-specimen]", ...["primary", "secondary", "danger", "quiet"].map(LIVE)]) {
    await page.mouse.move(0, 0);
    await page.waitForTimeout(200);
    const rest = await style(page, selector);
    expect(rest.duration).toBe("0.15s");
    expect(rest.property).toContain("background-color");
    expect(rest.property).toContain("box-shadow");

    await page.locator(selector).first().hover();
    expect(shows(rest.shadow), `${selector} rest shadow`).toBe(false);
    await expect.poll(async () => shows((await style(page, selector)).shadow), `${selector} hover shadow`).toBe(true);
    await page.waitForTimeout(200);
    const hover = await style(page, selector);
    expect(hover.bg, `${selector} hover fill`).not.toBe(rest.bg);

    await page.mouse.down();
    await page.waitForTimeout(200);
    const pressed = await style(page, selector);
    expect(pressed.bg, `${selector} pressed fill`).not.toBe(hover.bg);
    expect(pressed.bg, `${selector} pressed fill`).not.toBe(rest.bg);
    expect(shows(pressed.shadow), "no shadow when pressed").toBe(false);
    await page.mouse.up();
  }
  // Link variant: underline on hover, darker text when pressed.
  const link = LIVE("link");
  await page.mouse.move(0, 0);
  const rest = await style(page, link);
  expect(rest.underline).toBe("none");
  await page.locator(link).first().hover();
  await expect.poll(async () => (await style(page, link)).underline).toBe("underline");
  await page.mouse.down();
  await expect.poll(async () => (await style(page, link)).color).not.toBe(rest.color);
  await page.mouse.up();

  // Disabled buttons do not react.
  for (const variant of ["primary", "secondary", "danger", "quiet"]) {
    await page.mouse.move(0, 0);
    const before = await style(page, DISABLED(variant));
    await page.locator(DISABLED(variant)).first().hover({ force: true });
    await page.waitForTimeout(200);
    expect(await style(page, DISABLED(variant)), `${variant} disabled`).toEqual(before);
  }
});

test("buttons: no transition with reduced motion", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await open(page, "/dev/components");
  expect((await style(page, LIVE("primary"))).property).toBe("none");
  expect((await style(page, "[data-testid=button-link-specimen]")).property).toBe("none");
});

test.describe("on a touch device without hover", () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });

  test("buttons: no hover fill or shadow (hover styles need a hover-capable pointer)", async ({ page }) => {
    await open(page, "/dev/components");
    expect(await page.evaluate(() => matchMedia("(hover: hover)").matches)).toBe(false);
    for (const selector of ["[data-testid=button-link-specimen]", LIVE("primary")]) {
      const rest = await style(page, selector);
      await page.locator(selector).first().hover();
      await page.waitForTimeout(200);
      const after = await style(page, selector);
      expect(after.bg).toBe(rest.bg);
      expect(shows(after.shadow)).toBe(false);
    }
  });
});