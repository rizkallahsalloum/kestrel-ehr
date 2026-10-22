import { expect, type Page } from "@playwright/test";
import { IDENTITIES, type IdentityKey } from "../../scripts/fixtures.ts";
import { loadTestEnv } from "../../scripts/test-env.ts";

export async function signIn(page: Page, key: IdentityKey): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email").fill(IDENTITIES[key].email);
  await page.getByLabel("Password").fill(loadTestEnv().testUserPassword);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByTestId("current-user")).toContainText(IDENTITIES[key].fullName);
}

/** Signs out through the account menu. */
export async function signOut(page: Page): Promise<void> {
  const menu = page.getByRole("menu", { name: "Account" });
  await expect(async () => {
    await page.getByRole("button", { name: /account menu/ }).click();
    await expect(menu).toBeVisible({ timeout: 1_000 });
  }).toPass({ timeout: 30_000 });
  await menu.getByRole("menuitem", { name: "Sign out" }).click();
}