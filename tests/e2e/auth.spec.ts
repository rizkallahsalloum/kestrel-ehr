import { expect, test } from "@playwright/test";
import { PATIENTS } from "../../scripts/fixtures.ts";
import { loadTestEnv } from "../../scripts/test-env.ts";
import { signIn, signOut } from "./helpers";

test("unauthenticated visitors are redirected to login", async ({ page }) => {
  await page.goto("/patients");
  await expect(page).toHaveURL(/\/login$/);
  await page.goto(`/patients/${PATIENTS.northOne}`);
  await expect(page).toHaveURL(/\/login$/);
});

test("wrong credentials show one generic error", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("clinician.a@kestrel.example");
  await page.getByLabel("Password").fill("definitely-wrong-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("Email or password is incorrect.");
});

test("a clinician sees only their team's patients", async ({ page }) => {
  await signIn(page, "clinicianA");
  await expect(page).toHaveURL(/\/patients$/);
  await expect(page.getByRole("link", { name: /Testcase, Rowan/ })).toBeVisible();
  await expect(page.getByText("Mockridge")).toHaveCount(0);
});

test("another team's patient URL returns not found", async ({ page }) => {
  await signIn(page, "clinicianA");
  await page.goto(`/patients/${PATIENTS.southOne}`);
  await expect(page.getByRole("heading", { name: "Not found" })).toBeVisible();
});

test("an inactive account cannot sign in", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("inactive@kestrel.example");
  await page.getByLabel("Password").fill(loadTestEnv().testUserPassword);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("not active");
});

test("sign out ends the session", async ({ page }) => {
  await signIn(page, "clinicianA");
  await signOut(page);
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/patients");
  await expect(page).toHaveURL(/\/login$/);
});

test("Privacy mode stays on across navigation and is off after signing out and in again", async ({ page }) => {
  const privacy = page.getByTestId("privacy-toggle");
  await signIn(page, "clinicianA");
  await expect(privacy).toHaveAttribute("aria-pressed", "false");
  await expect(async () => {
    await privacy.click();
    await expect(privacy).toHaveAttribute("aria-pressed", "true", { timeout: 1_000 });
  }).toPass({ timeout: 30_000 });
  await expect(privacy).toBeFocused();
  await expect(page.getByRole("link", { name: /Patient name hidden/ }).first()).toBeVisible();
  await expect(page.getByRole("main")).not.toContainText("Testcase");

  await page.goto(`/patients/${PATIENTS.northOne}`);
  const heading = page.getByRole("main").getByRole("heading", { level: 1 });
  await expect(heading.getByRole("button", { name: "Patient name hidden, press to reveal" })).toBeVisible();
  await expect(page.getByRole("main")).not.toContainText("Testcase");
  expect(await page.getByRole("main").ariaSnapshot()).not.toContain("SYN-");

  await signOut(page);
  await expect(page).toHaveURL(/\/login$/);
  expect(await page.evaluate(() => sessionStorage.getItem("kestrel.privacy"))).toBeNull();
  expect(await page.evaluate(() => sessionStorage.getItem("kestrel.privacy.idle"))).toBeNull();
  expect(await page.evaluate(() => sessionStorage.getItem("kestrel.lastPatient"))).toBeNull();

  await signIn(page, "clinicianA");
  await expect(privacy).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByRole("link", { name: /Testcase, Rowan/ })).toBeVisible();
});
