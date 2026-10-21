import { expect, test, type Page } from "@playwright/test";
import { LAYOUT_WIDTHS, reviewPath } from "./support";

const WIDTHS = LAYOUT_WIDTHS;
const VIEWS = ["clinician", "admin", "login", "not-found", "error"] as const;

const searchBox = (page: Page) => page.getByRole("searchbox", { name: "Search patients by name or MRN" });
const patientRows = (page: Page) => page.locator("main table tbody tr");

/** Waits until hydration has attached the keyboard shortcut listener. */
async function pressUntilFocused(page: Page, key: string): Promise<void> {
  await expect(async () => {
    await page.getByRole("heading", { level: 1 }).click();
    await page.keyboard.press(key);
    await expect(searchBox(page)).toBeFocused({ timeout: 500 });
  }).toPass({ timeout: 30_000 });
}

for (const width of WIDTHS) {
  test(`shell and simple pages lay out without horizontal overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    for (const view of VIEWS) {
      await page.goto(`/dev/shell?view=${view}`);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(page.getByRole("banner").getByRole("note")).toContainText("Synthetic data prototype");
      await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect.soft(overflow, `${view} overflows horizontally`).toBeLessThanOrEqual(0);
      await page.screenshot({ path: reviewPath("shell", `${view}-${width}.png`), fullPage: true, caret: "initial" });
    }

    await page.goto("/dev/shell?view=clinician");
    const rail = page.locator("aside");
    expect((await rail.boundingBox())?.width).toBe(width > 760 ? 76 : 60);
    const label = page.getByRole("link", { name: "Patients" }).locator("span");
    expect(await label.evaluate((el) => el.getBoundingClientRect().width > 1)).toBe(width > 760);

    const search = await page.getByRole("search", { name: "Patients" }).boundingBox();
    const main = await page.locator("main").boundingBox();
    if (!search || !main) throw new Error("missing layout boxes");
    if (width <= 760) expect(search.width).toBeGreaterThan(main.width - 80);
    else expect(search.width).toBeLessThanOrEqual(300);
  });
}

test("rail marks the current section and the identity block names the user", async ({ page }) => {
  await page.goto("/dev/shell?view=clinician");
  await expect(page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Patients" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  const current = page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Patients" });
  const { color, shadow } = await current.evaluate((el) => {
    const style = getComputedStyle(el);
    return { color: style.color, shadow: style.boxShadow };
  });
  expect(shadow).toContain(color);
  await expect(page.getByTestId("current-user")).toContainText("Dr. Demo Clinician");
  await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();

  await page.goto("/dev/shell?view=admin");
  await expect(page.getByRole("link", { name: "Audit" })).toHaveAttribute("aria-current", "page");
  await expect(searchBox(page)).toHaveCount(0);
});

test("skip link is the first stop and moves focus to the main content", async ({ page }) => {
  await page.goto("/dev/shell?view=clinician");
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Skip to main content" });
  await expect(skip).toBeFocused();
  await expect(skip).toBeInViewport();
  await page.keyboard.press("Enter");
  await expect(page.locator("main")).toBeFocused();
});

test("/ and Ctrl+K focus the search; / still types inside a text field", async ({ page }) => {
  await page.goto("/dev/shell?view=clinician");
  await pressUntilFocused(page, "/");
  await expect(searchBox(page)).toHaveValue("");

  await page.keyboard.type("a/b");
  await expect(searchBox(page)).toHaveValue("a/b");

  await pressUntilFocused(page, "Control+k");
});

test("search filters the patient list on the server and can be cleared", async ({ page }) => {
  await page.goto("/dev/shell?view=clinician");
  await expect(patientRows(page)).toHaveCount(4);

  await pressUntilFocused(page, "/");
  await page.keyboard.type("rowan");
  await page.keyboard.press("Enter");

  await expect(page).toHaveURL(/[?&]q=rowan/);
  await expect(page.getByRole("status")).toHaveText(/1 patient matches “rowan”\./);
  await expect(patientRows(page)).toHaveCount(1);
  await expect(page.getByRole("link", { name: "Testcase, Rowan" })).toBeVisible();
  await expect(searchBox(page)).toHaveValue("rowan");

  await searchBox(page).fill("nobody");
  await searchBox(page).press("Enter");
  await expect(page.getByRole("status")).toHaveText(/No patients match “nobody”\./);
  await expect(page.getByText("No patients on your care teams match this search.")).toBeVisible();

  await page.getByRole("link", { name: "Clear search" }).click();
  await expect(patientRows(page)).toHaveCount(4);
  await expect(searchBox(page)).toHaveValue("");
});
