import fs from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { hideDevOverlay, reviewPath } from "./support";

// Phase 8c/8d top bar: cursor rule, account menu, Today's queue, sync status, Privacy button and the rail.
// Runs on the /dev specimens; queue switching against real data is in tests/e2e.

const CHART = "/dev/chart?view=blocking";
const ROWAN = "00000000-0000-4000-8000-000000000101";
/** Rowan's specimen URL reference (src/app/dev/demo-queue.ts); URLs use refs, `data-queue-item` the id. */
const ROWAN_REF = "syn0000101";
const trigger = (page: Page) => page.getByRole("button", { name: /account menu/i });
const menu = (page: Page) => page.getByRole("menu", { name: "Account" });
const queueBar = (page: Page) => page.locator("nav[data-queue]").filter({ visible: true });
const privacy = (page: Page) => page.getByTestId("privacy-toggle");

async function open(page: Page, url = CHART): Promise<void> {
  await page.goto(url);
  await page.waitForLoadState("networkidle");
  await hideDevOverlay(page);
}

/** Opens the account menu once hydration has attached the popover. */
async function openMenu(page: Page): Promise<void> {
  await expect(async () => {
    await trigger(page).click();
    await expect(menu(page)).toBeVisible({ timeout: 1_000 });
  }).toPass({ timeout: 30_000 });
}

const focusedName = (page: Page) => page.evaluate(() => document.activeElement?.textContent?.trim() ?? "");

test("cursor: pointer on buttons, links, menu items and checkbox labels; not-allowed on disabled controls", async ({ page }) => {
  await open(page, "/dev/components");
  const cursor = (selector: string) => page.locator(selector).first().evaluate((el) => getComputedStyle(el).cursor);
  expect(await cursor("main button:not(:disabled)")).toBe("pointer");
  expect(await cursor("main a[href]")).toBe("pointer");
  expect(await cursor("main button:disabled")).toBe("not-allowed");
  expect(await cursor("main label:has(input[type=checkbox]:not(:disabled))")).toBe("pointer");
  // Text fields keep the text cursor.
  expect(["auto", "text"]).toContain(await cursor("main input:not([type]):not(:disabled), main input[type=text]:not(:disabled)"));

  await open(page);
  expect(await cursor("[data-queue-item]")).toBe("pointer");
  expect(await cursor("[data-testid=privacy-toggle]")).toBe("pointer");
  await openMenu(page);
  expect(await cursor("[role=menuitemradio]")).toBe("pointer");
  expect(await cursor("[role=menuitem]")).toBe("pointer");
});

test("account menu: menu-button keyboard pattern, focus return, Space keeps it open, Tab and outside click close it", async ({ page }) => {
  await open(page);
  await expect(trigger(page)).toHaveAttribute("aria-haspopup", "menu");
  await expect(trigger(page)).toHaveAttribute("aria-expanded", "false");

  // Mouse: opens on the first item.
  await openMenu(page);
  await expect(trigger(page)).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByRole("group", { name: "Privacy auto-hide" }).getByRole("menuitemradio")).toHaveCount(3);
  await expect(page.getByRole("menuitemradio", { name: "30 seconds" })).toBeFocused();
  await expect(page.getByRole("menuitemradio", { name: "1 minute" })).toHaveAttribute("aria-checked", "true");

  // Roving focus with wrapping, Home and End.
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("menuitemradio", { name: "1 minute" })).toBeFocused();
  await page.keyboard.press("End");
  await expect(page.getByRole("menuitem", { name: "Sign out" })).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("menuitemradio", { name: "30 seconds" })).toBeFocused();
  await page.keyboard.press("ArrowUp");
  await expect(page.getByRole("menuitem", { name: "Sign out" })).toBeFocused();
  await page.keyboard.press("Home");
  await expect(page.getByRole("menuitemradio", { name: "30 seconds" })).toBeFocused();

  // Escape closes and returns focus to the trigger.
  await page.keyboard.press("Escape");
  await expect(menu(page)).toBeHidden();
  await expect(trigger(page)).toBeFocused();
  await expect(trigger(page)).toHaveAttribute("aria-expanded", "false");

  // ArrowDown on the trigger opens on the checked item; ArrowUp opens on the last.
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("menuitemradio", { name: "1 minute" })).toBeFocused();
  await page.keyboard.press("Escape");
  await page.keyboard.press("ArrowUp");
  await expect(page.getByRole("menuitem", { name: "Sign out" })).toBeFocused();

  // Space selects and keeps the menu open; Enter selects and closes with focus on the trigger.
  await page.keyboard.press("Home");
  await page.keyboard.press("Space");
  await expect(menu(page)).toBeVisible();
  await expect(page.getByRole("menuitemradio", { name: "30 seconds" })).toHaveAttribute("aria-checked", "true");
  expect(await page.evaluate(() => sessionStorage.getItem("kestrel.privacy.idle"))).toBe("30000");
  await page.keyboard.press("End");
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("Enter");
  await expect(menu(page)).toBeHidden();
  await expect(trigger(page)).toBeFocused();
  expect(await page.evaluate(() => sessionStorage.getItem("kestrel.privacy.idle"))).toBe("120000");

  // Tab closes and moves on from the trigger.
  await page.keyboard.press("Enter");
  await expect(menu(page)).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(menu(page)).toBeHidden();
  expect(await focusedName(page)).not.toBe("");
  expect(await page.evaluate(() => Boolean(document.activeElement?.closest("[role=menu]")))).toBe(false);

  // Outside click closes.
  await openMenu(page);
  await page.getByRole("heading", { level: 1 }).click();
  await expect(menu(page)).toBeHidden();
  await expect(trigger(page)).toHaveAttribute("aria-expanded", "false");
});

test("Today's queue: chips link to charts, the current patient is marked, View all opens the list, no Back to patients", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await open(page);
  const queue = page.getByRole("navigation", { name: "Today's queue" }).filter({ visible: true });
  const chips = queue.locator("[data-queue-item]");
  await expect(chips).toHaveCount(6);
  // Ordered by alert severity, then family name.
  // The status text sits inline, so the names have no stray space before the comma.
  await expect(chips.nth(0)).toHaveAccessibleName("Rowan Testcase, Critical alert");
  await expect(chips.nth(1)).toHaveAccessibleName("Mira Demoson, Warning");
  await expect(chips.nth(2)).toHaveAccessibleName("Jun Fixture, Warning");
  await expect(chips.nth(3)).toHaveAccessibleName("Ada Mockridge, No alerts");
  await expect(chips.nth(0)).toHaveAttribute("href", `/patients/${ROWAN_REF}`);
  await expect(chips.nth(0)).toHaveAttribute("aria-current", "page");
  await expect(queue.locator("[aria-current]")).toHaveCount(1);
  expect(await chips.nth(0).locator("[data-status]").getAttribute("data-status")).toBe("critical");
  expect(await chips.nth(1).locator("[data-status]").getAttribute("data-status")).toBe("warning");
  expect(await chips.nth(3).locator("[data-status]").getAttribute("data-status")).toBe("stable");

  const viewAll = queue.getByRole("link", { name: /View all/ });
  await expect(viewAll).toHaveAttribute("href", "/patients");
  await expect(viewAll).toContainText("7");
  await expect(page.getByRole("link", { name: "Back to patients" })).toHaveCount(0);

  // The prescribing area is a deeper page of the same patient.
  await open(page, "/dev/prescribing?view=blocking");
  await expect(queueBar(page).locator(`[data-queue-item="${ROWAN}"]`)).toHaveAttribute("aria-current", "true");

  // The admin shell has no queue.
  await open(page, "/dev/shell?view=admin");
  await expect(page.locator("nav[data-queue]")).toHaveCount(0);
});

test("Today's queue with Privacy on: names and initials masked, dots kept, distinct accessible names", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await open(page);
  const queue = queueBar(page);
  const before = await queue.locator("[data-queue-item]").evaluateAll((els) =>
    els.map((el) => {
      const r = el.getBoundingClientRect();
      return `${r.x.toFixed(2)},${r.y.toFixed(2)} ${r.width.toFixed(2)}x${r.height.toFixed(2)}`;
    }),
  );
  await expect(async () => {
    await privacy(page).click();
    await expect(privacy(page)).toHaveAttribute("aria-pressed", "true", { timeout: 1_000 });
  }).toPass({ timeout: 30_000 });

  const names = await queue.locator("[data-queue-item]").evaluateAll((els) => els.map((el) => el.getAttribute("aria-label")));
  expect(names).toEqual([
    "Patient 1 of 6, name hidden, Critical alert",
    "Patient 2 of 6, name hidden, Warning",
    "Patient 3 of 6, name hidden, Warning",
    "Patient 4 of 6, name hidden, No alerts",
    "Patient 5 of 6, name hidden, No alerts",
    "Patient 6 of 6, name hidden, No alerts",
  ]);
  expect(new Set(names).size).toBe(6);
  const tree = await queue.ariaSnapshot();
  for (const value of ["Rowan", "Testcase", "Mira", "Demoson", "Jun", "Fixture"]) expect(tree).not.toContain(value);
  await expect(queue.locator("[data-status]")).toHaveCount(6);
  const after = await queue.locator("[data-queue-item]").evaluateAll((els) =>
    els.map((el) => {
      const r = el.getBoundingClientRect();
      return `${r.x.toFixed(2)},${r.y.toFixed(2)} ${r.width.toFixed(2)}x${r.height.toFixed(2)}`;
    }),
  );
  expect(after, "queue chips keep their boxes when masked").toEqual(before);
});

test("sync status: online by default, offline turns the dot red and says Offline, both changes are announced", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await open(page);
  const sync = page.getByTestId("sync-status");
  await expect(sync).toBeVisible();
  await expect(sync).toHaveText(/Synced with Kestrel Health Network · (just now|\d+ min ago)/);
  await expect(sync.locator("[data-status]")).toHaveAttribute("data-status", "stable");

  const live = page.locator("header [aria-live=polite]");
  await expect(async () => {
    await page.context().setOffline(false);
    await page.context().setOffline(true);
    await expect(sync).toHaveAttribute("data-online", "false", { timeout: 1_000 });
  }).toPass({ timeout: 30_000 });
  await expect(sync).toContainText("Offline");
  await expect(sync.locator("[data-status]")).toHaveAttribute("data-status", "critical");
  await expect(live).toHaveText("Offline, changes are not syncing");

  await page.context().setOffline(false);
  await expect(sync).toHaveAttribute("data-online", "true");
  await expect(sync).toContainText("Synced with Kestrel Health Network");
  await expect(live).toHaveText("Back online");
});

test("sync status updates the relative time every minute without announcing it", async ({ page }) => {
  await page.clock.install();
  await page.setViewportSize({ width: 1440, height: 900 });
  await open(page);
  const sync = page.getByTestId("sync-status");
  await expect(sync).toContainText("just now");
  await page.clock.fastForward(2 * 60_000 + 1_000);
  await expect(sync).toContainText("2 min ago");
  // The live region may hold the idle auto-hide announcement, but never the sync time.
  await expect(page.locator("header [aria-live=polite]")).not.toContainText(/min ago|synced|online/i);
});

/** A token colour as the browser computes it. */
const tokenColor = (page: Page, name: string) =>
  page.evaluate((token) => {
    const probe = document.createElement("span");
    probe.style.color = `var(--color-${token})`;
    document.body.append(probe);
    const color = getComputedStyle(probe).color;
    probe.remove();
    return color;
  }, name);
const css = (page: Page, property: "color" | "backgroundColor" | "borderTopWidth" | "outlineStyle" | "outlineColor") =>
  privacy(page).evaluate((el, p) => getComputedStyle(el)[p], property);

test("Privacy button: ghost at rest, warm fill on hover only; eye and 'Privacy' off, eye-off and 'Privacy on' in green", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await open(page);
  const icon = () => privacy(page).locator("svg").first().evaluate((svg) => svg.innerHTML);
  await expect(privacy(page)).toHaveAttribute("aria-pressed", "false");
  await expect(privacy(page)).toHaveAccessibleName("Privacy");
  await expect(privacy(page)).toHaveAttribute("aria-keyshortcuts", "Control+. Meta+.");
  const offIcon = await icon();
  const offBox = await privacy(page).boundingBox();

  // At rest: no fill, no border; secondary text colour.
  await page.mouse.move(0, 0);
  await expect.poll(() => css(page, "backgroundColor")).toBe("rgba(0, 0, 0, 0)");
  expect(await css(page, "borderTopWidth")).toBe("0px");
  await expect.poll(() => css(page, "color")).toBe(await tokenColor(page, "ink-secondary"));
  // Hover: the surface-hover fill.
  await privacy(page).hover();
  await expect.poll(() => css(page, "backgroundColor")).toBe(await tokenColor(page, "surface-warm"));

  await expect(async () => {
    await privacy(page).click();
    await expect(privacy(page)).toHaveAttribute("aria-pressed", "true", { timeout: 1_000 });
  }).toPass({ timeout: 30_000 });
  await expect(privacy(page)).toHaveAccessibleName("Privacy on");
  expect(await icon()).not.toBe(offIcon);
  // Polled: colour and fill transitions may still be running.
  await expect.poll(() => css(page, "color")).toBe(await tokenColor(page, "ok"));
  await page.mouse.move(0, 0);
  await expect.poll(() => css(page, "backgroundColor")).toBe("rgba(0, 0, 0, 0)");
  expect(await css(page, "borderTopWidth")).toBe("0px");
  expect(await privacy(page).boundingBox(), "the button does not change size").toEqual(offBox);

  // Keyboard focus shows the normal focus ring.
  await trigger(page).focus();
  await page.keyboard.press("Shift+Tab");
  await expect(privacy(page)).toBeFocused();
  expect(await css(page, "outlineStyle")).toBe("solid");
  expect(await css(page, "outlineColor")).toBe(await tokenColor(page, "focus"));

  // Below `lg` (820px) the label is visually hidden; the accessible name stays.
  await page.setViewportSize({ width: 819, height: 900 });
  const labelWidth = await privacy(page).evaluate((el) => el.querySelector(":scope > span")!.getBoundingClientRect().width);
  expect(labelWidth).toBeLessThanOrEqual(1);
  await expect(privacy(page)).toHaveAccessibleName("Privacy on");
});

for (const width of [1440, 1024, 760, 390]) {
  test(`Privacy button at ${width}px: right side, after the sync status, immediately left of the account menu`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await open(page);
    const button = await privacy(page).boundingBox();
    const menuButton = await trigger(page).boundingBox();
    expect(button && menuButton).toBeTruthy();
    // Same row, to the left of the account menu, with nothing between them.
    expect(button!.x + button!.width).toBeLessThanOrEqual(menuButton!.x);
    expect(Math.abs(button!.y + button!.height / 2 - (menuButton!.y + menuButton!.height / 2))).toBeLessThanOrEqual(1);
    const next = await privacy(page).evaluate((el) => {
      let sibling = el.nextElementSibling;
      while (sibling && sibling.matches("[aria-live]")) sibling = sibling.nextElementSibling;
      return Boolean(sibling?.querySelector("[aria-haspopup=menu]"));
    });
    expect(next, "the account menu follows the Privacy button").toBe(true);
    // The sync status (shown from xl) comes before it.
    const sync = page.getByTestId("sync-status");
    if (width >= 1180) {
      const box = await sync.boundingBox();
      expect(box!.x + box!.width).toBeLessThanOrEqual(button!.x);
    } else {
      await expect(sync).toBeHidden();
    }
    // On the right: past the search from 761px; in the right-aligned controls row below.
    if (width > 760) {
      const search = await page.getByRole("search").boundingBox();
      expect(button!.x).toBeGreaterThan(search!.x + search!.width);
    }
    const right = await page.locator("[data-topbar]").evaluate((el) => el.getBoundingClientRect().right);
    expect(right - (menuButton!.x + menuButton!.width)).toBeLessThan(40);
    await page.screenshot({ path: reviewPath("top-bar", `privacy-${width}.png`), clip: { x: 0, y: 0, width, height: 200 } });
  });
}

test("rail: Chart, Schedule, E-Rx, Labs and Billing; targets follow the current patient; placeholder pages", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await open(page);
  const rail = page.getByRole("navigation", { name: "Main" });
  const items = rail.getByRole("link");
  await expect(items).toHaveText(["Chart", "Schedule", "E-Rx", "Labs", "Billing"]);
  await expect(rail.getByRole("link", { name: "Chart" })).toHaveAttribute("href", `/patients/${ROWAN_REF}`);
  await expect(rail.getByRole("link", { name: "Chart" })).toHaveAttribute("aria-current", "page");
  await expect(rail.getByRole("link", { name: "E-Rx" })).toHaveAttribute("href", `/patients/${ROWAN_REF}/prescriptions/new`);
  await expect(rail.getByRole("link", { name: "Schedule" })).toHaveAttribute("href", "/schedule");
  await expect(rail.getByRole("link", { name: "Labs" })).toHaveAttribute("href", "/labs");
  await expect(rail.getByRole("link", { name: "Billing" })).toHaveAttribute("href", "/billing");
  for (const name of ["Chart", "Schedule", "E-Rx", "Labs", "Billing"]) {
    await expect(rail.getByRole("link", { name }).locator("svg")).toHaveCount(1);
  }
  // One user avatar in the rail; the account menu has its own trigger avatar in the top bar.
  await expect(page.locator("aside .rounded-full")).toHaveCount(1);

  await open(page, "/dev/prescribing?view=blocking");
  await expect(rail.getByRole("link", { name: "E-Rx" })).toHaveAttribute("aria-current", /page|true/);
  await expect(rail.getByRole("link", { name: "Chart" })).not.toHaveAttribute("aria-current", /.+/);

  await open(page, "/dev/shell?view=placeholder");
  await expect(page.getByRole("heading", { level: 1, name: "Schedule" })).toBeVisible();
  await expect(page.getByRole("main")).toContainText("Not part of this prototype");
  await expect(page.getByRole("banner")).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Main" })).toBeVisible();
  await expect(rail.getByRole("link", { name: "Schedule" })).toHaveAttribute("aria-current", "page");
  // The last chart viewed in this tab (Rowan, from the chart specimen) is where Chart goes.
  await expect(rail.getByRole("link", { name: "Chart" })).toHaveAttribute("href", `/patients/${ROWAN_REF}`);
  await expect(page.getByRole("main").getByRole("link", { name: "Go to patients" })).toHaveAttribute("href", "/patients");

  await open(page, "/dev/shell?view=admin");
  await expect(rail.getByRole("link")).toHaveText(["Audit"]);
});

test("no circle alert icon is left in the source", () => {
  const roots = ["src", "tests"].map((dir) => path.join(process.cwd(), dir));
  const offenders: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(tsx?|css)$/.test(entry.name) && !full.endsWith("top-bar.spec.ts")) {
        const text = fs.readFileSync(full, "utf8");
        if (/AlertCircle|alert-circle|circle-alert/i.test(text)) offenders.push(path.relative(process.cwd(), full));
      }
    }
  };
  roots.forEach(walk);
  expect(offenders).toEqual([]);
});

/** Smallest width where N queue items sit on the search row; mirrors `--breakpoint-queue-inline-N` in globals.css. */
const INLINE_AT: Record<number, number> = { 1: 1470, 2: 1660, 3: 1840, 4: 2030, 5: 2210, 6: 2390, 7: 2580 };
const isInline = (width: number, items: number) => width >= INLINE_AT[items]!;
/** Columns of the queue grid (`--queue-cols`): one per item when inline, else 5 from xl, 3 from md, 2 below. */
const queueCols = (width: number, items: number) =>
  isInline(width, items) ? items : width >= 1180 ? 5 : width >= 761 ? 3 : 2;

for (const width of [2560, 1440, 1024, 760, 390]) {
  for (const patients of [1, 3, 7]) {
    test(`Today's queue at ${width}px with ${patients} patient(s): wraps, never scrolls sideways, nothing under the sticky bar`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await open(page, `/dev/prescribing?view=blocking&queue=${patients}`);
      const bar = page.locator("[data-topbar]");
      const queue = queueBar(page);
      await expect(queue).toBeVisible();
      const chips = queue.locator("[data-queue-item]");
      await expect(chips).toHaveCount(Math.min(patients, 6));
      await expect(queue.getByRole("link", { name: /View all/ })).toHaveCount(patients > 6 ? 1 : 0);

      const layout = await page.evaluate(() => {
        const topbar = document.querySelector<HTMLElement>("[data-topbar]")!;
        const nav = topbar.querySelector<HTMLElement>("nav[data-queue]")!;
        const list = nav.querySelector("ul")!;
        const probe = document.createElement("div");
        probe.style.height = "var(--topbar-height)";
        document.body.append(probe);
        const tokenHeight = probe.getBoundingClientRect().height;
        probe.remove();
        const rect = (el: Element) => el.getBoundingClientRect();
        const items = [...list.children].map(rect);
        return {
          barHeight: rect(topbar).height,
          tokenHeight,
          pageOverflow: document.documentElement.scrollWidth - window.innerWidth,
          listOverflow: list.scrollWidth - list.clientWidth,
          listOverflowX: getComputedStyle(list).overflowX,
          navTop: rect(nav).top,
          navLeft: rect(nav).left,
          navRight: rect(nav).right,
          controlsBottom: rect(topbar.querySelector(".area-controls")!).bottom,
          itemTops: [...new Set(items.map((r) => Math.round(r.top)))],
          outside: items.filter((r) => r.left < rect(nav).left - 0.5 || r.right > rect(nav).right + 0.5).length,
        };
      });
      // No sideways scrolling anywhere; every chip is inside the queue.
      expect(layout.pageOverflow).toBeLessThanOrEqual(0);
      expect(layout.listOverflow).toBeLessThanOrEqual(0);
      expect(["visible", "clip", "hidden"]).toContain(layout.listOverflowX);
      expect(layout.outside).toBe(0);
      // Its own row under the controls, wrapping onto more lines, until the items fit on the search row.
      const items = Math.min(patients, 6) + (patients > 6 ? 1 : 0);
      const inline = isInline(width, items);
      if (inline) expect(layout.navTop).toBeLessThan(layout.controlsBottom);
      else expect(layout.navTop).toBeGreaterThanOrEqual(layout.controlsBottom);
      expect(layout.itemTops).toHaveLength(inline ? 1 : Math.ceil(items / queueCols(width, items)));
      // The sticky offsets follow the bar: its height is exactly --topbar-height.
      expect(Math.abs(layout.barHeight - layout.tokenHeight)).toBeLessThanOrEqual(0.5);

      // Tracker jumps and anchors stop below the bar; sticky columns stick below it.
      const sections = page.locator("main section[id]");
      const count = await sections.count();
      expect(count).toBeGreaterThan(0);
      for (let i = 0; i < count; i++) {
        await sections.nth(i).evaluate((el) => el.scrollIntoView({ block: "start", behavior: "instant" }));
        const barBottom = (await bar.boundingBox())!.y + layout.barHeight;
        const top = (await sections.nth(i).boundingBox())!.y;
        expect(top, `section ${i + 1} below the sticky bar`).toBeGreaterThanOrEqual(barBottom - 0.5);
      }
      const stickyTops = await page.evaluate(() =>
        [...document.querySelectorAll("main *")]
          .filter((el) => getComputedStyle(el).position === "sticky")
          .map((el) => parseFloat(getComputedStyle(el).top)),
      );
      for (const top of stickyTops) expect(top).toBeGreaterThanOrEqual(layout.barHeight - 0.5);
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: reviewPath("top-bar", `queue-${patients}-${width}.png`), clip: { x: 0, y: 0, width, height: 360 } });
    });
  }
}

for (const width of [1440, 1024, 760, 390]) {
  test(`top bar at ${width}px: sync visibility, no overflow, no shift when masking`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await open(page);
    await expect(page.getByTestId("sync-status")).toBeVisible({ visible: width >= 1180 });
    await expect(trigger(page)).toBeVisible();
    await expect(privacy(page)).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);

    const boxes = () =>
      page.evaluate(() =>
        // Top bar, queue and chart hero. Wrapped multi-line values further down (the prescriptions table
        // at 390px) are a known Privacy trade-off, documented in docs/theme.md.
        [...document.querySelectorAll("header > div, nav[data-queue], [data-queue-item], main header, main h1")].map((el) => {
          const r = el.getBoundingClientRect();
          return `${el.tagName} ${r.x.toFixed(2)},${r.y.toFixed(2)} ${r.width.toFixed(2)}x${r.height.toFixed(2)}`;
        }),
      );
    const before = await boxes();
    await expect(async () => {
      await privacy(page).click();
      await expect(privacy(page)).toHaveAttribute("aria-pressed", "true", { timeout: 1_000 });
    }).toPass({ timeout: 30_000 });
    expect(await boxes(), "no layout shift when masking").toEqual(before);
    await page.screenshot({ path: reviewPath("top-bar", `masked-${width}.png`), caret: "initial" });
    await privacy(page).click();
    await expect(privacy(page)).toHaveAttribute("aria-pressed", "false");
    expect(await boxes(), "no layout shift when showing").toEqual(before);
    await page.screenshot({ path: reviewPath("top-bar", `shown-${width}.png`), caret: "initial" });
  });
}

test("queue chip avatars: teal, green and blue by patient id, stable across reloads, reordering and masking, never named", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const id = (n: number) => `00000000-0000-4000-8000-00000000010${n}`;
  const chips = () => queueBar(page).locator("[data-queue-item]");
  const avatarColours = () =>
    chips().evaluateAll((els) =>
      Object.fromEntries(
        els.map((el) => [el.getAttribute("data-queue-item")!, getComputedStyle(el.querySelector(":scope > span")!).backgroundColor]),
      ),
    );
  const names = () => chips().evaluateAll((els) => els.map((el) => el.getAttribute("aria-label") ?? el.textContent ?? ""));

  await open(page);
  const [teal, green, blue] = await Promise.all(["avatar-teal", "avatar-green", "avatar-blue"].map((t) => tokenColor(page, t)));
  // Sorted ids 101…107 over the whole queue (seven patients; 107 is behind "View all"): index mod 3.
  const expected = { [id(1)]: teal, [id(2)]: green, [id(3)]: blue, [id(4)]: teal, [id(5)]: green, [id(6)]: blue };
  expect(await avatarColours()).toEqual(expected);
  expect(new Set(Object.values(expected)).size).toBe(3);
  for (const name of await chips().evaluateAll((els) => els.map((el) => el.textContent ?? ""))) {
    expect(name).not.toMatch(/teal|green|blue|red|colou?r/i);
  }
  for (const i of [0, 1, 2]) await expect(chips().nth(i)).not.toHaveAccessibleName(/teal|green|blue|red|colou?r/i);

  // Reload: same colours.
  await page.reload();
  await hideDevOverlay(page);
  expect(await avatarColours()).toEqual(expected);

  // Reordered (every status moved to the next patient): different order and a different hidden
  // patient, same colour per patient.
  await open(page, `${CHART}&queueOrder=rotated`);
  const rotated = await avatarColours();
  expect(Object.keys(rotated)).not.toEqual(Object.keys(expected));
  expect(rotated[id(7)]).toBe(teal);
  for (const [patient, colour] of Object.entries(rotated)) {
    if (patient in expected) expect(colour, patient).toBe(expected[patient]);
  }

  // Masked: initials become "••" and keep their colour; names never mention a colour.
  await open(page);
  await expect(async () => {
    await privacy(page).click();
    await expect(privacy(page)).toHaveAttribute("aria-pressed", "true", { timeout: 1_000 });
  }).toPass({ timeout: 30_000 });
  await expect(chips().first().locator(":scope > span").first()).toHaveText("••");
  expect(await avatarColours()).toEqual(expected);
  for (const name of await names()) expect(name).not.toMatch(/teal|green|blue|red|colou?r/i);
  expect(await queueBar(page).ariaSnapshot()).not.toMatch(/teal|green|blue|red|colou?r/i);

  // One patient: teal.
  await open(page, `${CHART}&queue=1`);
  expect(await avatarColours()).toEqual({ [id(1)]: teal });
});

test("Today's queue statuses by case: critical, warning and stable chips are told apart by dot and name", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await open(page);
  const chips = queueBar(page).locator("[data-queue-item]");
  const statuses = await chips.evaluateAll((els) => els.map((el) => el.querySelector("[data-status]")?.getAttribute("data-status")));
  expect(statuses).toEqual(["critical", "warning", "warning", "stable", "stable", "stable"]);
  const colours = await chips.evaluateAll((els) =>
    els.map((el) => getComputedStyle(el.querySelector("[data-status]")!).backgroundColor),
  );
  expect(new Set(colours).size, "three distinct dot colours").toBe(3);
  for (const [i, label] of ["Critical alert", "Warning", "Warning", "No alerts", "No alerts", "No alerts"].entries()) {
    await expect(chips.nth(i)).toHaveAccessibleName(new RegExp(`^[A-Za-zë]+ [A-Za-z]+, ${label}$`));
  }
});

test("Today's queue chips: no outline ring at rest, on hover, when current or on click; keyboard focus is an inset focus border; only the dot takes the status colour", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await open(page);
  const chips = queueBar(page).locator("[data-queue-item]");
  const look = () =>
    chips.evaluateAll((els) => {
      const colour = (value: string) => {
        const probe = document.createElement("div");
        probe.style.color = value;
        document.body.append(probe);
        const c = getComputedStyle(probe).color;
        probe.remove();
        return c;
      };
      return {
        statusColours: ["var(--color-status-critical)", "var(--color-status-warning)", "var(--color-danger)", "var(--color-warning)"].map(colour),
        focus: colour("var(--color-focus)"),
        chips: els.map((el) => {
          const cs = getComputedStyle(el);
          const dot = getComputedStyle(el.querySelector("[data-status]")!);
          return {
            status: el.querySelector("[data-status]")!.getAttribute("data-status"),
            current: el.hasAttribute("aria-current"),
            ring: cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) > 0,
            boxShadow: cs.boxShadow,
            container: [cs.borderTopColor, cs.backgroundColor, cs.color].join(" | "),
            dotRing: dot.outlineStyle !== "none" && parseFloat(dot.outlineWidth) > 0,
          };
        }),
      };
    });

  const rest = await look();
  expect(rest.chips.filter((c) => c.current)).toHaveLength(1);
  for (const chip of rest.chips) {
    expect(chip.ring, `${chip.status} chip has no outline ring`).toBe(false);
    expect(chip.boxShadow, `${chip.status} chip has no ring shadow`).toBe("none");
    expect(chip.dotRing, `${chip.status} dot has no ring`).toBe(false);
    for (const part of chip.container.split(" | ")) {
      expect(rest.statusColours, `${chip.status} chip container takes no status colour`).not.toContain(part);
    }
  }
  // Chips that are not current look the same whatever the status: only the dot differs.
  const others = rest.chips.filter((c) => !c.current);
  expect(new Set(others.map((c) => c.status)).size).toBeGreaterThan(1);
  expect(new Set(others.map((c) => c.container)).size, "one container style for every status").toBe(1);
  // The current chip is marked by its fill and border, not by a ring.
  expect(rest.chips.find((c) => c.current)!.container).not.toBe(others[0]!.container);

  const index = rest.chips.findIndex((c) => !c.current);
  const target = chips.nth(index);
  await target.hover();
  const hovered = (await look()).chips[index]!;
  expect(hovered.ring, "no ring on hover").toBe(false);
  expect(hovered.boxShadow).toBe("none");

  // Mouse down focuses the link without :focus-visible: no ring. Releasing away from it skips navigation.
  await page.mouse.down();
  expect(await target.evaluate((el) => document.activeElement === el && !el.matches(":focus-visible"))).toBe(true);
  const pressed = (await look()).chips[index]!;
  expect(pressed.ring, "no ring on click").toBe(false);
  expect(pressed.boxShadow).toBe("none");
  await page.mouse.move(5, 890);
  await page.mouse.up();

  // Keyboard: Tab onto the next chip gives a visible inset border in the focus colour, still no outline.
  await page.keyboard.press("Shift");
  await target.focus();
  await page.keyboard.press("Tab");
  const next = chips.nth(index + 1);
  expect(await next.evaluate((el) => document.activeElement === el && el.matches(":focus-visible"))).toBe(true);
  // The border colour transitions in.
  await expect.poll(async () => {
    const now = await look();
    return now.chips[index + 1]!.container.split(" | ")[0] === now.focus;
  }, { message: "focus-coloured border" }).toBe(true);
  const focused = (await look()).chips[index + 1]!;
  expect(focused.ring, "no outline ring on keyboard focus").toBe(false);
  expect(focused.boxShadow, "inset ring thickens the border").toMatch(/inset/);
  await page.screenshot({ path: reviewPath("top-bar", "queue-chip-focus.png"), clip: { x: 0, y: 0, width: 1440, height: 200 } });
});

test("patient header meta line: age and sex together, then DOB; masked together with Privacy on", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  for (const url of [CHART, "/dev/prescribing?view=blocking"]) {
    await open(page, url);
    const meta = page.locator("main p.font-mono").filter({ hasText: "DOB" }).first();
    await expect(meta.locator("span").first()).toHaveText(/^\d+[FM] · DOB \S.*$/);
    await expect(meta.locator("abbr")).toHaveCount(0);
    await expect(async () => {
      await privacy(page).click();
      await expect(privacy(page)).toHaveAttribute("aria-pressed", "true", { timeout: 1_000 });
    }).toPass({ timeout: 30_000 });
    const first = meta.locator("span").first();
    const text = (await first.innerText()).replace(/\s+/g, " ");
    // One mask for age and sex, a space, then the DOB label: nothing of the sex value leaks.
    expect(text).toMatch(/^•+ · DOB •+$/);
    expect(text).not.toMatch(/[FM]\b|unknown|female|male/);
    await privacy(page).click();
    await expect(privacy(page)).toHaveAttribute("aria-pressed", "false");
  }
});

test("rail: all five labels fit inside their items at 1440px and 761px", async ({ page }) => {
  for (const width of [1440, 761]) {
    await page.setViewportSize({ width, height: 900 });
    await open(page);
    const labels = await page.getByRole("navigation", { name: "Main" }).getByRole("link").evaluateAll((links) =>
      links.map((link) => {
        const label = link.querySelector("span")!;
        const l = label.getBoundingClientRect();
        const a = link.getBoundingClientRect();
        const rail = link.closest("aside")!.getBoundingClientRect();
        return {
          text: label.textContent,
          fits: label.scrollWidth <= label.clientWidth + 0.5 || getComputedStyle(label).display === "inline",
          inside: l.left >= a.left - 0.5 && l.right <= a.right + 0.5,
          inRail: a.left >= rail.left && a.right <= rail.right,
          width: l.width,
        };
      }),
    );
    expect(labels.map((l) => l.text)).toEqual(["Chart", "Schedule", "E-Rx", "Labs", "Billing"]);
    for (const label of labels) {
      expect(label.inside, `${label.text} inside its item at ${width}px`).toBe(true);
      expect(label.inRail, `${label.text} item inside the rail at ${width}px`).toBe(true);
      expect(label.width, `${label.text} is visible`).toBeGreaterThan(10);
    }
  }
});
