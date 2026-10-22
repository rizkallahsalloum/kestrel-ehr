import { expect, test, type Locator, type Page } from "@playwright/test";
import { MEDICATIONS, PATIENTS } from "../../scripts/fixtures.ts";
import { signIn } from "./helpers";

const MEDICATION_NAMES: Record<string, string> = {
  [MEDICATIONS.calvexa]: "Calvexa",
  [MEDICATIONS.zentoril]: "Zentoril",
};

async function createDraft(page: Page, patientId: string, medicationId: string): Promise<void> {
  await page.goto(`/patients/${patientId}`);
  await page.getByRole("link", { name: "New prescription draft" }).click();
  const name = MEDICATION_NAMES[medicationId]!;
  await page.getByRole("combobox", { name: "Medication (synthetic catalog)" }).fill(name);
  await page.getByRole("option", { name: new RegExp(`^${name}`) }).click();
  await expect(page.locator('input[name="medicationId"]')).toHaveValue(medicationId);
  await page.getByLabel("Dose amount").fill("10");
  await page.getByLabel("Quantity").fill("30");
  await page.getByRole("button", { name: "Create draft" }).click();
  await expect(page).toHaveURL(new RegExp(`/patients/${patientId}/prescriptions/[0-9a-f-]{36}$`));
}

test("clinician drafts, acknowledges an advisory alert, and signs", async ({ page }) => {
  await signIn(page, "clinicianA");
  await createDraft(page, PATIENTS.northTwo, MEDICATIONS.calvexa);

  // The sign button's label names the next missing step, so it is located by test id.
  const sign = page.getByTestId("sign-button");
  await expect(sign).toBeDisabled();
  await expect(sign).toHaveText("Run the safety check to sign");

  await page.getByRole("button", { name: "Run safety check" }).click();
  await expect(page.getByRole("status")).toContainText("0 blocking, 1 advisory");
  const alerts = page.getByRole("list", { name: "Safety alerts" });
  await expect(alerts.getByText("Advisory", { exact: true })).toBeVisible();
  await expect(sign).toHaveText("Acknowledge 1 advisory alert to sign");

  await page.getByRole("button", { name: "Acknowledge advisory alert" }).click();
  await expect(alerts.getByText("Acknowledged", { exact: true })).toBeVisible();

  await page.getByRole("checkbox").check();
  await expect(sign).toBeEnabled();
  await expect(sign).toHaveText("Sign prescription (simulated)");
  await sign.click();
  await expect(page.getByText("Signed (simulated). Not transmitted anywhere.")).toBeVisible();
  await expect(page.getByText("signed", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Run safety check" })).toHaveCount(0);

  await page.getByRole("link", { name: "Back to chart" }).click();
  await expect(page.getByRole("list", { name: "Active medications" }).getByText("from signed prescription")).toBeVisible();
});

test("a blocking demo alert cannot be acknowledged or signed; the chart banner shows only while the draft has one", async ({ page }) => {
  await signIn(page, "clinicianA");
  const alertSlot = page.getByRole("region", { name: "Demo safety alerts" });
  const banner = alertSlot.getByText("Allergy conflict on today's order", { exact: true });

  // Rowan's severe allergy alone is not an order conflict: no draft, so the empty state and no banner.
  await page.goto(`/patients/${PATIENTS.northOne}`);
  await expect(alertSlot.getByText("No unresolved demo safety alerts on this patient's drafts.")).toBeVisible();
  await expect(banner).toHaveCount(0);

  await createDraft(page, PATIENTS.northOne, MEDICATIONS.zentoril);

  await page.getByRole("button", { name: "Run safety check" }).click();
  await expect(page.getByRole("status")).toContainText("1 blocking");
  await expect(page.getByRole("list", { name: "Safety alerts" }).getByText("Blocking", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Acknowledge advisory alert" })).toHaveCount(0);

  await page.getByRole("checkbox").check();
  await expect(page.getByTestId("sign-button")).toBeDisabled();
  await expect(page.getByTestId("sign-button")).toHaveText("Blocking alert: change or cancel the draft");
  await expect(page.getByRole("list", { name: "Signing prerequisites" })).toContainText("blocking demo alert");

  await page.goto(`/patients/${PATIENTS.northOne}`);
  await expect(banner.first()).toBeVisible();
  await expect(alertSlot).toContainText("Draft: Zentoril 10 mg tablet.");
  await expect(alertSlot.getByText("No unresolved demo safety alerts on this patient's drafts.")).toHaveCount(0);
  // Top of the workspace: under the patient header, above the Prescriptions card.
  const top = async (locator: Locator) => (await locator.boundingBox())!.y;
  const headerTop = await top(page.getByRole("main").getByRole("heading", { level: 1 }));
  const bannerTop = await top(banner.first());
  const prescriptionsTop = await top(page.getByRole("table", { name: "Prescriptions" }));
  expect(bannerTop).toBeGreaterThan(headerTop);
  expect(bannerTop).toBeLessThan(prescriptionsTop);
  await expect(page.getByRole("button", { name: /acknowledge/i })).toHaveCount(0);
  await page.getByRole("link", { name: /^Review draft/ }).first().click();
  await expect(page).toHaveURL(new RegExp(`/patients/${PATIENTS.northOne}/prescriptions/[0-9a-f-]{36}$`));
});

test("clinician keeps a draft, then cancels it with feedback", async ({ page }) => {
  await signIn(page, "clinicianA");
  await createDraft(page, PATIENTS.northTwo, MEDICATIONS.calvexa);
  const draftUrl = page.url();
  const trigger = page.getByRole("button", { name: "Cancel this draft" });
  const dialog = page.getByRole("dialog", { name: "Cancel this draft?" });

  await trigger.click();
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();

  await trigger.click();
  await dialog.getByLabel("Reason (optional)").fill("Not needed (synthetic)");
  await dialog.getByRole("button", { name: "Keep draft" }).click();
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
  await page.reload();
  await expect(page.getByText("draft", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Dose amount")).toHaveValue("10");
  await expect(page.getByLabel("Quantity")).toHaveValue("30");

  await trigger.click();
  await dialog.getByLabel("Reason (optional)").fill("Entered in error (synthetic)");
  await dialog.getByRole("button", { name: "Cancel draft" }).click();
  await expect(page.getByText("cancelled", { exact: true })).toBeVisible();
  await expect(page.getByRole("status")).toContainText("This draft was cancelled");
  await expect(trigger).toHaveCount(0);
  await expect(page.getByTestId("sign-button")).toHaveCount(0);
  await expect(page).toHaveURL(draftUrl);
});

test("admins can read the audit log but not patient charts", async ({ page }) => {
  await signIn(page, "admin");
  await expect(page).toHaveURL(/\/admin\/audit$/);
  await expect(page.getByRole("heading", { name: "Audit log" })).toBeVisible();
  const table = page.getByRole("table");
  await expect(table.getByRole("columnheader")).toHaveText(["When (UTC)", "Action", "Actor", "Entity", "Patient", "Details"]);
  await expect(table.getByRole("row").nth(1)).toBeVisible();
  await page.goto(`/patients/${PATIENTS.northOne}`);
  await expect(page.getByRole("heading", { name: "Not found" })).toBeVisible();
});

test("clinicians cannot open the audit log", async ({ page }) => {
  await signIn(page, "clinicianA");
  await page.goto("/admin/audit");
  await expect(page.getByRole("heading", { name: "Not found" })).toBeVisible();
});
