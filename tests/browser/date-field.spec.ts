import { expect, test } from "@playwright/test";

// The specimen date field has the known duplicate calendar icon (docs/theme.md, Known issues).
// It must stay usable from the keyboard until Phase 5 settles the treatment.
test("date field with a leading icon accepts keyboard entry", async ({ page }) => {
  await page.goto("/dev/components");
  const field = page.getByRole("textbox", { name: "Date" });
  await expect(field).toHaveValue("2026-10-19");

  await field.click();
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Tab");
  await page.keyboard.type("01022027");

  await expect(field).toHaveValue("2027-01-02");
});
