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
