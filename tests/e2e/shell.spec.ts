import { expect, test } from "@playwright/test";
import { PATIENTS } from "../../scripts/fixtures.ts";
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
  await expect(page.getByRole("navigation", { name: "Main" }).getByRole("link")).toHaveText(["Audit"]);
  await expect(page.getByRole("navigation", { name: "Today's queue" })).toHaveCount(0);
});

test("Today's queue lists only care-team patients and switches charts; the current chip is marked", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page, "clinicianA");
  const queue = page.getByRole("navigation", { name: "Today's queue" }).filter({ visible: true });
  const chips = queue.locator("[data-queue-item]");
  await expect(chips.first()).toBeVisible();
  const ids = await chips.evaluateAll((els) => els.map((el) => el.getAttribute("data-queue-item")));
  expect(ids).toContain(PATIENTS.northOne);
  expect(ids).toContain(PATIENTS.northTwo);
  expect(ids).not.toContain(PATIENTS.southOne);
  expect(ids).not.toContain(PATIENTS.southTwo);
  // Every chip names its status in text, not by the dot colour alone.
  for (const name of await chips.evaluateAll((els) => els.map((el) => el.textContent ?? ""))) {
    expect(name).toMatch(/Critical alert|Warning|No alerts/);
  }

  await queue.locator(`[data-queue-item="${PATIENTS.northTwo}"]`).click();
  await expect(page).toHaveURL(new RegExp(`/patients/${PATIENTS.northTwo}$`));
  await expect(queue.locator(`[data-queue-item="${PATIENTS.northTwo}"]`)).toHaveAttribute("aria-current", "page");
  await expect(queue.locator("[aria-current]")).toHaveCount(1);
  await expect(page.getByRole("link", { name: "Back to patients" })).toHaveCount(0);

  await queue.locator(`[data-queue-item="${PATIENTS.northOne}"]`).click();
  await expect(page).toHaveURL(new RegExp(`/patients/${PATIENTS.northOne}$`));
  await expect(queue.locator(`[data-queue-item="${PATIENTS.northOne}"]`)).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("main").getByRole("heading", { level: 1 })).toContainText("Testcase");

  // The rail follows the current patient.
  const rail = page.getByRole("navigation", { name: "Main" });
  await expect(rail.getByRole("link", { name: "Chart" })).toHaveAttribute("href", `/patients/${PATIENTS.northOne}`);
  await expect(rail.getByRole("link", { name: "E-Rx" })).toHaveAttribute("href", `/patients/${PATIENTS.northOne}/prescriptions/new`);
});

test("Schedule, Labs and Billing open placeholder pages with no patient data", async ({ page }) => {
  await signIn(page, "clinicianA");
  const rail = page.getByRole("navigation", { name: "Main" });
  for (const name of ["Schedule", "Labs", "Billing"]) {
    await rail.getByRole("link", { name }).click();
    await expect(page.getByRole("main").getByRole("heading", { level: 1, name })).toBeVisible();
    await expect(page.getByRole("main")).toContainText("Not part of this prototype");
    await expect(page.getByRole("main")).not.toContainText("SYN-");
    await expect(rail.getByRole("link", { name })).toHaveAttribute("aria-current", "page");
    await expect(page).toHaveTitle(`${name} | Kestrel EHR`);
  }
});
