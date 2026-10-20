import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test("patient search filters the care-team list and never reveals other teams", async ({ page }) => {
  await signIn(page, "clinicianA");

  const search = page.getByRole("searchbox", { name: "Search patients by name or MRN" });
  await search.fill("rowan");
  await search.press("Enter");
  await expect(page).toHaveURL(/\/patients\?q=rowan$/);
  await expect(page.getByRole("link", { name: "Testcase, Rowan" })).toBeVisible();

  await search.fill("Mockridge");
  await search.press("Enter");
  await expect(page.getByText("No patients match “Mockridge”.")).toBeVisible();
  await expect(page.getByRole("link", { name: /Mockridge/ })).toHaveCount(0);
});

test("an administrator sees the audit rail item and no patient search", async ({ page }) => {
  await signIn(page, "admin");
  await expect(page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Audit" })).toBeVisible();
  await expect(page.getByRole("searchbox")).toHaveCount(0);
});
