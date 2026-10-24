import { expect, test, type Page } from "@playwright/test";

// Keyboard behaviour in a real browser: visible focus indicators, the combobox, the E-Rx section
// tracker and how errors are announced. Contrast uses the WCAG 2 relative-luminance formula.

type Indicator = {
  element: string;
  kind: "outline" | "field ring" | "none";
  ratio: number;
  /** For field rings: whether the ring colour differs from the unfocused border. */
  changed: boolean;
};

/**
 * Measures the focus indicator of the focused element: its own outline (drawn outside, so compared
 * with the parent's background), or the ring a field wrapper draws with `:focus-within` (its border,
 * compared with the colours on both sides of it, and with the border it had before focus).
 */
function measureFocus(page: Page): Promise<Indicator | null> {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el || el === document.body) return null;

    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    const paint = (layers: string[]): number[] => {
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, 1, 1);
      for (const layer of layers) {
        ctx.fillStyle = layer;
        ctx.fillRect(0, 0, 1, 1);
      }
      return [...ctx.getImageData(0, 0, 1, 1).data.slice(0, 3)];
    };
    const backgrounds = (node: Element | null): string[] => {
      const layers: string[] = [];
      for (let n = node; n; n = n.parentElement) {
        const bg = getComputedStyle(n).backgroundColor;
        if (bg && bg !== "transparent" && bg !== "rgba(0, 0, 0, 0)") layers.unshift(bg);
      }
      return layers;
    };
    const luminance = (rgb: number[]) => {
      const [r, g, b] = rgb.map((v) => {
        const c = v / 255;
        return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
    };
    const ratio = (a: number[], b: number[]) => {
      const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
      return (hi! + 0.05) / (lo! + 0.05);
    };
    const name = `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ""} "${(el.getAttribute("aria-label") ?? el.textContent ?? "").trim().slice(0, 40)}"`;

    const cs = getComputedStyle(el);
    if (cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) >= 2) {
      const behind = backgrounds(el.parentElement);
      const ring = paint([...behind, cs.outlineColor]);
      return { element: name, kind: "outline" as const, ratio: ratio(ring, paint(behind)), changed: true };
    }

    // Its own border, thickened by an inset ring (Today's queue chips): compared like a field ring.
    if (cs.boxShadow !== "none") {
      const focusedBorder = cs.borderTopColor;
      el.blur();
      const restBorder = getComputedStyle(el).borderTopColor;
      el.focus({ preventScroll: true });
      if (focusedBorder !== restBorder) {
        const ring = paint([...backgrounds(el.parentElement), focusedBorder]);
        return {
          element: name,
          kind: "field ring" as const,
          ratio: Math.min(ratio(ring, paint(backgrounds(el.parentElement))), ratio(ring, paint(backgrounds(el)))),
          changed: true,
        };
      }
    }

    const drawsRing = (node: HTMLElement) => {
      const style = getComputedStyle(node);
      return style.boxShadow !== "none" || (style.outlineStyle !== "none" && parseFloat(style.outlineWidth) >= 2);
    };
    let wrapper: HTMLElement | null = el.parentElement;
    for (let i = 0; wrapper && i < 3 && !drawsRing(wrapper); i++) wrapper = wrapper.parentElement;
    if (!wrapper || !drawsRing(wrapper)) {
      return { element: name, kind: "none" as const, ratio: 1, changed: false };
    }
    const ws = getComputedStyle(wrapper);
    if (ws.outlineStyle !== "none" && parseFloat(ws.outlineWidth) >= 2) {
      const behind = backgrounds(wrapper.parentElement);
      const ring = paint([...behind, ws.outlineColor]);
      el.blur();
      const unfocused = getComputedStyle(wrapper).outlineStyle;
      el.focus({ preventScroll: true });
      return { element: name, kind: "field ring" as const, ratio: ratio(ring, paint(behind)), changed: unfocused === "none" };
    }
    const focused = ws.borderTopColor;
    const outside = backgrounds(wrapper.parentElement);
    const inside = backgrounds(wrapper);
    const ring = paint([...outside, focused]);
    el.blur();
    const unfocused = getComputedStyle(wrapper).borderTopColor;
    el.focus({ preventScroll: true });
    return {
      element: name,
      kind: "field ring" as const,
      ratio: Math.min(ratio(ring, paint(outside)), ratio(ring, paint(inside))),
      changed: focused !== unfocused,
    };
  });
}

async function ready(page: Page, url: string): Promise<void> {
  await page.goto(url);
  await page.waitForLoadState("networkidle");
  // Colour transitions (100-150ms) would otherwise be sampled half-way; the settled state is what counts.
  await page.addStyleTag({
    content: "nextjs-portal { display: none !important; } *, *::before, *::after { transition: none !important; }",
  });
}

/** Presses Tab `count` times from the current focus and measures every stop. */
async function tabThrough(page: Page, count: number, key = "Tab"): Promise<Indicator[]> {
  const seen: Indicator[] = [];
  for (let i = 0; i < count; i++) {
    await page.keyboard.press(key);
    const indicator = await measureFocus(page);
    if (indicator) seen.push(indicator);
  }
  return seen;
}

function expectVisibleRings(stops: Indicator[], where: string): void {
  console.log(`${where}: ${stops.map((s) => `${s.element} ${s.kind} ${s.ratio.toFixed(2)}`).join(" | ")}`);
  expect(stops.length, where).toBeGreaterThan(0);
  const weak = stops.filter((s) => s.kind === "none" || s.ratio < 3 || !s.changed);
  expect(weak, where).toEqual([]);
}

test.describe("focus indicators", () => {
  for (const width of [1440, 390]) {
    test(`rail, top bar and patient list at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await ready(page, "/dev/shell?view=clinician");
      expectVisibleRings(await tabThrough(page, 9), `shell clinician ${width}`);
    });
  }

  test("admin rail on the inverse background", async ({ page }) => {
    await ready(page, "/dev/shell?view=admin");
    const stops = await tabThrough(page, 4);
    expectVisibleRings(stops, "shell admin");
    expect(stops.some((s) => s.element.includes("Audit"))).toBe(true);
  });

  test("sign-in form", async ({ page }) => {
    await ready(page, "/dev/shell?view=login");
    expectVisibleRings(await tabThrough(page, 4), "login");
  });

  test("new prescription form: tracker, combobox, sentence controls and fields", async ({ page }) => {
    await ready(page, "/dev/prescribing?view=new");
    await page.getByRole("navigation", { name: "Prescription sections" }).getByRole("link").first().focus();
    expectVisibleRings(await tabThrough(page, 16), "prescribing new");
  });

  test("saved draft review panel (dark header, alerts, sign controls)", async ({ page }) => {
    await ready(page, "/dev/prescribing?view=mixed");
    await page.locator("#rx-review").getByRole("button").first().focus();
    expectVisibleRings(await tabThrough(page, 10), "prescribing mixed review");
  });

  test("dialog controls", async ({ page }) => {
    await ready(page, "/dev/components");
    await expect(async () => {
      await page.getByRole("button", { name: "Open dialog" }).click();
      await expect(page.getByRole("dialog")).toBeVisible({ timeout: 1_000 });
    }).toPass({ timeout: 30_000 });
    const first = await measureFocus(page);
    expectVisibleRings([first!, ...(await tabThrough(page, 3))], "dialog");
  });

  test("a field with an error keeps a visible focus ring", async ({ page }) => {
    await ready(page, "/dev/components");
    const demo = page.getByTestId("submit-errors-demo");
    const quantity = demo.getByRole("spinbutton", { name: /Quantity/ });
    await expect(async () => {
      await demo.getByRole("button", { name: "Submit with errors" }).click();
      await expect(quantity).toHaveAttribute("aria-invalid", "true", { timeout: 1_000 });
    }).toPass({ timeout: 30_000 });
    await demo.getByRole("button", { name: "Submit with errors" }).focus();
    expectVisibleRings(await tabThrough(page, 1, "Shift+Tab"), "invalid field");
  });
});

test.describe("combobox keyboard (real browser)", () => {
  const input = (page: Page) => page.getByRole("combobox", { name: /Medication \(combobox\)/ });
  const listbox = (page: Page) => page.getByRole("listbox", { name: "Medication (combobox)" });
  const activeOption = (page: Page) =>
    input(page).evaluate((el) => {
      const id = el.getAttribute("aria-activedescendant");
      const option = id ? document.getElementById(id) : null;
      return option ? { text: option.textContent, selected: option.getAttribute("aria-selected") } : null;
    });

  test.beforeEach(async ({ page }) => {
    await ready(page, "/dev/components");
    await expect(async () => {
      await input(page).focus();
      await expect(input(page)).toHaveAttribute("aria-expanded", "true", { timeout: 1_000 });
    }).toPass({ timeout: 30_000 });
  });

  test("arrow keys move the active option, wrap, and keep focus in the input", async ({ page }) => {
    await expect(listbox(page)).toBeVisible();
    await expect(listbox(page).getByRole("option")).toHaveCount(4);
    expect(await activeOption(page)).toBeNull();

    await page.keyboard.press("ArrowDown");
    expect(await activeOption(page)).toEqual({ text: expect.stringContaining("Demozolam 5 mg"), selected: "true" });
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowDown");
    expect((await activeOption(page))?.text).toContain("Testoprilat");
    await page.keyboard.press("ArrowUp");
    expect((await activeOption(page))?.text).toContain("Demozolam 10 mg");
    await page.keyboard.press("ArrowUp");
    await page.keyboard.press("ArrowUp");
    expect((await activeOption(page))?.text, "ArrowUp from the first option wraps to the last").toContain("Placebrex");
    await expect(input(page)).toBeFocused();
  });

  test("typing filters and announces, Enter picks, Escape restores, Tab closes", async ({ page }) => {
    await page.keyboard.type("demo");
    await expect(listbox(page).getByRole("option")).toHaveCount(2);
    await expect(page.getByText("2 results available.")).toBeAttached();
    expect(await activeOption(page), "typing resets the active option").toBeNull();

    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await expect(input(page)).toHaveAttribute("aria-expanded", "false");
    await expect(input(page)).toHaveValue("Demozolam 10 mg tablet");
    await expect(page.getByText("Selected value: m2")).toBeVisible();
    await expect(input(page)).toBeFocused();

    await page.keyboard.press("ArrowDown");
    await expect(input(page)).toHaveAttribute("aria-expanded", "true");
    await page.keyboard.press("Control+A");
    await page.keyboard.type("zzz");
    await expect(input(page)).toHaveAttribute("aria-expanded", "false");
    await expect(page.getByText("No matches for \u201czzz\u201d.").first()).toBeAttached();
    await page.keyboard.press("Escape");
    await expect(input(page)).toHaveValue("Demozolam 10 mg tablet");
    await expect(page.getByText("Selected value: m2")).toBeVisible();

    await page.keyboard.press("ArrowDown");
    await expect(input(page)).toHaveAttribute("aria-expanded", "true");
    await page.keyboard.press("Tab");
    await expect(listbox(page)).toBeHidden();
    await expect(input(page)).not.toBeFocused();
  });
});

test.describe("E-Rx section tracker", () => {
  for (const [width, patients] of [[1440, 1], [1440, 7], [1024, 3], [760, 7], [390, 1], [390, 7]] as const) {
    test(`links are in order, describe progress, and move the reading position at ${width}px with ${patients} queue patient(s)`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await ready(page, `/dev/prescribing?view=new&queue=${patients}`);
      const links = page.getByRole("navigation", { name: "Prescription sections" }).getByRole("link");
      await expect(links).toHaveCount(3);
      await expect(links.nth(0)).toHaveAccessibleName(/Medication.*\(not complete\)/);
      await expect(links.nth(1)).toHaveAccessibleName(/Directions and supply.*\((not )?complete\)/);
      await expect(links.nth(2)).toHaveAccessibleName(/Review.*\(not complete\)/);

      await links.nth(0).focus();
      await page.keyboard.press("Tab");
      await expect(links.nth(1)).toBeFocused();
      await page.keyboard.press("Tab");
      await expect(links.nth(2)).toBeFocused();

      await page.keyboard.press("Shift+Tab");
      await page.keyboard.press("Enter");
      await expect(page).toHaveURL(/#rx-directions$/);
      const geometry = await page.evaluate(() => {
        const section = document.getElementById("rx-directions")!.getBoundingClientRect();
        // The header landmark is `display: contents`; the sticky top bar is its only div.
        const header = document.querySelector("header > div")!.getBoundingClientRect();
        return { top: section.top, headerBottom: header.bottom, viewport: window.innerHeight };
      });
      expect(geometry.top, "section starts below the sticky top bar").toBeGreaterThanOrEqual(geometry.headerBottom - 1);
      expect(geometry.top).toBeLessThan(geometry.viewport / 2);

      // Focus moves to the section (tabIndex -1, named by its heading); the next Tab continues inside it.
      const section = page.getByRole("region", { name: "Directions and supply" });
      await expect(section).toBeFocused();
      await page.keyboard.press("Tab");
      await expect(page.locator("#doseAmount")).toBeFocused();

      await links.nth(2).focus();
      await page.keyboard.press("Enter");
      await expect(page.getByRole("region", { name: "Review prescription" })).toBeFocused();
    });
  }
});

test.describe("error announcements", () => {
  test("errors after a submit are announced once each, without nested live regions", async ({ page }) => {
    await ready(page, "/dev/components");
    const demo = page.getByTestId("submit-errors-demo");
    await expect(demo.getByRole("alert")).toHaveCount(0);

    const submit = demo.getByRole("button", { name: "Submit with errors" });
    await expect(async () => {
      await submit.click();
      await expect(demo.getByRole("alert")).toHaveCount(2, { timeout: 1_000 });
    }).toPass({ timeout: 30_000 });
    const texts = await demo.getByRole("alert").allTextContents();
    expect(new Set(texts).size, "each message has its own alert").toBe(2);
    await expect(demo.getByRole("spinbutton", { name: /Quantity/ })).toHaveAccessibleDescription(
      "Enter a whole number of 1 or more.",
    );

    await submit.click();
    await expect(demo.getByRole("alert"), "re-submitting does not add duplicates").toHaveCount(2);
    const nested = await demo.evaluate((root) => {
      const live = "[role=alert], [role=status], [aria-live]:not([aria-live=off])";
      return [...root.querySelectorAll(live)].filter((el) => el.parentElement?.closest(live)).length;
    });
    expect(nested).toBe(0);
  });

  test("chart alert banners: critical are alerts with a pulse, advisory are polite statuses, under a labelled heading", async ({ page }) => {
    await ready(page, "/dev/chart?view=mixed");
    const region = page.getByRole("region", { name: "Demo safety alerts" });
    await expect(region).toBeVisible();
    const critical = region.locator(':scope > [data-severity="critical"]');
    const warning = region.locator(':scope > [data-severity="warning"]');
    await expect(critical).not.toHaveCount(0);
    await expect(warning).not.toHaveCount(0);
    for (const banner of await critical.all()) {
      await expect(banner).toHaveAttribute("role", "alert");
      await expect(banner.locator("[data-alert-pulse]")).toHaveCount(1);
    }
    for (const banner of await warning.all()) {
      await expect(banner).toHaveAttribute("role", "status");
      await expect(banner.locator("[data-alert-pulse]")).toHaveCount(0);
    }
    await expect(page.getByRole("main").getByRole("alert")).toHaveCount(await critical.count());
    const titles = await region.locator("p.font-semibold").allTextContents();
    expect(titles.length).toBe(new Set(titles).size);
    expect(titles[0], "blocking first").toBe("Allergy conflict on pending order");
  });

  test("error screens announce one alert", async ({ page }) => {
    await ready(page, "/dev/error");
    await expect(page.getByRole("main").getByRole("alert")).toHaveCount(1);
  });
});
