import fs from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { hideDevOverlay, reviewPath } from "./support";

// Phase 8c top bar: cursor rule, account menu, Today's queue, sync status, Privacy pill and the rail.
// Runs on the /dev specimens; queue switching against real data is in tests/e2e.

const CHART = "/dev/chart?view=blocking";
const ROWAN = "00000000-0000-4000-8000-000000000101";
const trigger = (page: Page) => page.getByRole("button", { name: /account menu/ });
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
  await expect(chips.nth(0)).toHaveAccessibleName(/Rowan Testcase\s*, Critical alert/);
  await expect(chips.nth(1)).toHaveAccessibleName(/Mira Demoson\s*, Warning/);
  await expect(chips.nth(2)).toHaveAccessibleName(/Jun Fixture\s*, Warning/);
  await expect(chips.nth(3)).toHaveAccessibleName(/No alerts/);
  await expect(chips.nth(0)).toHaveAttribute("href", `/patients/${ROWAN}`);
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

test("Privacy pill: eye icon and 'Privacy' when off, a different eye-off icon and 'Privacy mode on' when on", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await open(page);
  const icon = () => privacy(page).locator("svg").first().evaluate((svg) => svg.innerHTML);
  await expect(privacy(page)).toHaveAttribute("aria-pressed", "false");
  await expect(privacy(page)).toHaveAccessibleName("Privacy");
  await expect(privacy(page)).toHaveAttribute("aria-keyshortcuts", "Control+. Meta+.");
  const offIcon = await icon();
  const offBox = await privacy(page).boundingBox();

  await expect(async () => {
    await privacy(page).click();
    await expect(privacy(page)).toHaveAttribute("aria-pressed", "true", { timeout: 1_000 });
  }).toPass({ timeout: 30_000 });
  await expect(privacy(page)).toHaveAccessibleName("Privacy mode on");
  expect(await icon()).not.toBe(offIcon);
  // Polled: the pill's colour transition may still be running.
  await expect
    .poll(() =>
      privacy(page).evaluate((el) => {
        const probe = document.createElement("span");
        document.body.append(probe);
        probe.style.color = "var(--color-ok)";
        const ok = getComputedStyle(probe).color;
        probe.remove();
        return getComputedStyle(el).color === ok;
      }),
    )
    .toBe(true);
  expect(await privacy(page).boundingBox(), "the pill does not change size").toEqual(offBox);

  // Below `lg` (820px) the label is visually hidden; the accessible name stays.
  await page.setViewportSize({ width: 819, height: 900 });
  const labelWidth = await privacy(page).evaluate((el) => el.querySelector(":scope > span")!.getBoundingClientRect().width);
  expect(labelWidth).toBeLessThanOrEqual(1);
  await expect(privacy(page)).toHaveAccessibleName("Privacy mode on");
});

test("rail: Chart, Schedule, E-Rx, Labs and Billing; targets follow the current patient; placeholder pages", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await open(page);
  const rail = page.getByRole("navigation", { name: "Main" });
  const items = rail.getByRole("link");
  await expect(items).toHaveText(["Chart", "Schedule", "E-Rx", "Labs", "Billing"]);
  await expect(rail.getByRole("link", { name: "Chart" })).toHaveAttribute("href", `/patients/${ROWAN}`);
  await expect(rail.getByRole("link", { name: "Chart" })).toHaveAttribute("aria-current", "page");
  await expect(rail.getByRole("link", { name: "E-Rx" })).toHaveAttribute("href", `/patients/${ROWAN}/prescriptions/new`);
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
  await expect(rail.getByRole("link", { name: "Chart" })).toHaveAttribute("href", `/patients/${ROWAN}`);
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

for (const width of [1440, 1024, 760, 390]) {
  test(`top bar at ${width}px: queue placement, sync visibility, no overflow, no shift when masking`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await open(page);
    const bar = page.locator("nav[data-queue=bar]");
    const row = page.locator("nav[data-queue=row]");
    if (width > 760) {
      await expect(bar).toBeVisible();
      await expect(row).toBeHidden();
    } else {
      await expect(row).toBeVisible();
      await expect(bar).toBeHidden();
      // The row scrolls sideways inside itself; the page does not.
      const list = row.locator("ul");
      expect(await list.evaluate((el) => getComputedStyle(el).overflowX)).toBe("auto");
    }
    await expect(page.getByTestId("sync-status")).toBeVisible({ visible: width >= 1180 });
    await expect(trigger(page)).toBeVisible();
    await expect(privacy(page)).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);

    // Order in the bar: Privacy, queue, sync, account menu.
    if (width > 760) {
      const x = async (selector: string) => (await page.locator(selector).boundingBox())?.x ?? -1;
      const p = await x("[data-testid=privacy-toggle]");
      const q = await x("nav[data-queue=bar]");
      const m = (await trigger(page).boundingBox())?.x ?? -1;
      expect(p).toBeLessThan(q);
      expect(q).toBeLessThan(m);
    }

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

test("at 390px the queue row scrolls away and the sticky bar stays inside the 120px section offset", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page, "/dev/prescribing?view=blocking");
  const sticky = await page.locator("header > div").first().boundingBox();
  const row = page.locator("nav[data-queue=row]");
  await expect(row).toBeVisible();
  expect(await row.evaluate((el) => getComputedStyle(el).position)).not.toBe("sticky");
  const offset = await page.locator("main section[id]").first().evaluate((el) => parseFloat(getComputedStyle(el).scrollMarginTop));
  expect(offset).toBe(120);
  expect(sticky?.height ?? Infinity).toBeLessThanOrEqual(offset);
});