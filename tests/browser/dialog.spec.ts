import { expect, test, type Page } from "@playwright/test";

const dialogOf = (page: Page) => page.getByRole("dialog", { name: "Cancel this draft?" });
const triggerOf = (page: Page) => page.getByRole("button", { name: "Open dialog" });

/** Opens the demo dialog, retrying until hydration has attached the click handler. */
async function openDialog(page: Page): Promise<void> {
  await expect(async () => {
    await triggerOf(page).click();
    await expect(dialogOf(page)).toBeVisible({ timeout: 1_000 });
  }).toPass({ timeout: 30_000 });
}

/** Where focus is: inside the dialog, on the body (left the page), or on background content. */
function focusLocation(page: Page): Promise<string> {
  return page.evaluate(() => {
    const active = document.activeElement;
    if (!active || active === document.body) return "body";
    if (active.closest("dialog[open]")) return "dialog";
    return `background:${active.tagName.toLowerCase()}:${active.textContent?.trim().slice(0, 40) ?? ""}`;
  });
}

test.beforeEach(async ({ page }) => {
  await page.goto("/dev/components");
});

test("dialog has modal semantics, an accessible name and description, and initial focus inside", async ({ page }) => {
  await openDialog(page);
  const dialog = dialogOf(page);

  await expect(dialog).toHaveAccessibleName("Cancel this draft?");
  await expect(dialog).toHaveAccessibleDescription(/Escape closes it/);
  expect(await dialog.evaluate((el) => el.tagName === "DIALOG" && el.matches(":modal"))).toBe(true);
  await expect(dialog.getByRole("heading", { name: "Cancel this draft?", level: 2 })).toBeVisible();
  await expect(dialog.getByRole("textbox", { name: "Reason (optional)" })).toBeFocused();
});

test("Tab and Shift+Tab never move focus to background content", async ({ page }) => {
  await openDialog(page);
  const seen: string[] = [];
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press("Tab");
    seen.push(await focusLocation(page));
  }
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press("Shift+Tab");
    seen.push(await focusLocation(page));
  }
  // Native modal dialogs let focus step out to the browser UI ("body") after the last control;
  // the next Tab must come straight back into the dialog.
  expect(seen.filter((where) => where.startsWith("background"))).toEqual([]);
  seen.forEach((where, i) => {
    if (where === "body" && i + 1 < seen.length) expect(seen[i + 1]).toBe("dialog");
  });
  expect(seen.filter((where) => where === "dialog").length).toBeGreaterThan(seen.length / 2);
  await expect(dialogOf(page)).toBeVisible();
});

test("background content cannot be clicked or focused while the dialog is open", async ({ page }) => {
  const checkbox = page.getByRole("checkbox", { name: /Substitution allowed/ });
  await expect(checkbox).not.toBeChecked();
  await openDialog(page);

  // Bring the background checkbox to the top of the viewport, clear of the centred dialog.
  await checkbox.evaluate((el) => el.scrollIntoView({ block: "start" }));
  const box = await checkbox.boundingBox();
  if (!box) throw new Error("checkbox has no bounding box");
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;

  const hit = await page.evaluate(([px, py]) => document.elementFromPoint(px!, py!)?.tagName, [x, y]);
  expect(hit).toBe("DIALOG");
  await page.mouse.click(x, y);

  const focusedBackground = await checkbox.evaluate((el) => {
    (el as HTMLInputElement).focus();
    return document.activeElement === el;
  });
  expect(focusedBackground).toBe(false);
  await expect(dialogOf(page)).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(dialogOf(page)).toBeHidden();
  await expect(checkbox).not.toBeChecked();
});

test("Escape closes the dialog and returns focus to the trigger", async ({ page }) => {
  await openDialog(page);
  await page.keyboard.press("Escape");
  await expect(dialogOf(page)).toBeHidden();
  await expect(triggerOf(page)).toBeFocused();
});

test("Keep draft closes the dialog and returns focus to the trigger", async ({ page }) => {
  await openDialog(page);
  await dialogOf(page).getByRole("button", { name: "Keep draft" }).click();
  await expect(dialogOf(page)).toBeHidden();
  await expect(triggerOf(page)).toBeFocused();
});
