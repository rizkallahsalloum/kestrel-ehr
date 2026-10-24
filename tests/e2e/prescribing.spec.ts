import { expect, test, type Locator, type Page } from "@playwright/test";
import { MEDICATIONS, PATIENTS } from "../../scripts/fixtures.ts";
import { patientRef, REF } from "../helpers/refs";
import { signIn } from "./helpers";

const MEDICATION_NAMES: Record<string, string> = {
  [MEDICATIONS.calvexa]: "Calvexa",
  [MEDICATIONS.zentoril]: "Zentoril",
};

async function createDraft(page: Page, patientId: string, medicationId: string): Promise<void> {
  const ref = await patientRef(patientId);
  await page.goto(`/patients/${ref}`);
  await page.getByRole("link", { name: "New prescription draft" }).click();
  const name = MEDICATION_NAMES[medicationId]!;
  await page.getByRole("combobox", { name: "Medication (synthetic catalog)" }).fill(name);
  await page.getByRole("option", { name: new RegExp(`^${name}`) }).click();
  await expect(page.locator('input[name="medicationId"]')).toHaveValue(medicationId);
  await page.getByLabel("Dose amount").fill("10");
  await page.getByLabel("Quantity").fill("30");
  await page.getByRole("button", { name: "Create draft" }).click();
  await expect(page).toHaveURL(new RegExp(`/patients/${ref}/prescriptions/${REF}$`));
}

/** After the post-action refresh: a polite live region in the main region carries the result. */
async function expectAnnounced(page: Page, text: RegExp, step: string): Promise<void> {
  const live = page
    .getByRole("main")
    .locator('[role="status"], [aria-live="polite"]')
    .filter({ hasText: text })
    .filter({ visible: true });
  await expect(live, `${step}: a live region announces the result`).not.toHaveCount(0, { timeout: 5_000 });
}

/** Exactly one live region anywhere on the page carries the outcome: the toast must not repeat it. */
async function expectSingleAnnouncer(page: Page, text: RegExp, step: string): Promise<void> {
  const count = () =>
    page.evaluate(
      ({ source, flags }) => {
        const pattern = new RegExp(source, flags);
        const live = "[role=status], [role=alert], [role=log], [aria-live]:not([aria-live=off])";
        return [...document.querySelectorAll(live)].filter(
          (el) => pattern.test(el.textContent ?? "") && !el.parentElement?.closest(live),
        ).length;
      },
      { source: text.source, flags: text.flags },
    );
  await expect.poll(count, { message: `${step}: one live region carries the outcome`, timeout: 5_000 }).toBe(1);
}

const toasts = (page: Page) => page.locator("[data-toast]");

/** Focus lands on the named heading in the main region, never on document.body. */
async function expectFocusOnHeading(page: Page, name: string, step: string): Promise<void> {
  const heading = page.getByRole("main").getByRole("heading", { name, exact: true });
  await expect(heading, `${step}: focus moves to the "${name}" heading`).toBeFocused({ timeout: 5_000 });
  const focused = await page.evaluate(() => (document.activeElement === document.body ? "body" : document.activeElement?.tagName));
  expect(focused, `${step}: focus is not left on document.body`).not.toBe("body");
}

test("clinician drafts, acknowledges an advisory alert, and signs", async ({ page }) => {
  await signIn(page, "clinicianA");
  await createDraft(page, PATIENTS.northTwo, MEDICATIONS.calvexa);

  // The sign button's label names the next missing step, so it is located by test id.
  const sign = page.getByTestId("sign-button");
  await expect(sign).toBeDisabled();
  await expect(sign).toHaveText("Run the safety check to sign");

  await page.getByRole("button", { name: "Run safety check" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Safety check complete" })).toContainText("0 blocking, 1 advisory");
  const alerts = page.getByRole("list", { name: "Safety alerts" });
  await expect(alerts.getByText("Advisory", { exact: true })).toBeVisible();
  await expect(sign).toHaveText("Acknowledge 1 advisory alert to sign");

  await page.getByRole("button", { name: "Acknowledge advisory alert" }).click();
  await expect(alerts.getByText("Acknowledged", { exact: true })).toBeVisible();
  await expectAnnounced(page, /\b1 acknowledged/, "Acknowledge");
  await expectFocusOnHeading(page, "Safety decisions", "Acknowledge");
  await expect(toasts(page).filter({ hasText: "Advisory alert acknowledged." })).toHaveCount(1);
  await expectSingleAnnouncer(page, /acknowledged/i, "Acknowledge");

  await page.getByRole("checkbox").check();
  await expect(sign).toBeEnabled();
  await expect(sign).toHaveText("Sign prescription (simulated)");
  await sign.click();
  await expect(page.getByText("Signed (simulated). Not transmitted anywhere.")).toBeVisible();
  await expectAnnounced(page, /Prescription signed/, "Sign");
  await expectFocusOnHeading(page, "Signed (simulated)", "Sign");
  await expect(toasts(page).filter({ hasText: "Prescription signed (simulated)." })).toHaveCount(1);
  await expectSingleAnnouncer(page, /Prescription signed/, "Sign");
  await expect(page.getByText("signed", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Run safety check" })).toHaveCount(0);

  await page.getByRole("link", { name: "Back to chart" }).click();
  // Elliot also has a seeded signed Zentoril; the new medication is the Calvexa row.
  await expect(
    page
      .getByRole("list", { name: "Active medications" })
      .getByRole("listitem")
      .filter({ hasText: "Calvexa" })
      .getByText("from signed prescription"),
  ).toBeVisible();
});

test("a blocking demo alert cannot be acknowledged or signed; the chart banner shows only while the draft has one", async ({ page }) => {
  await signIn(page, "clinicianA");
  const alertSlot = page.getByRole("region", { name: "Demo safety alerts" });
  const banner = alertSlot.getByText("Allergy conflict on today's order", { exact: true });

  // Rowan's severe allergy alone is not an order conflict: no draft, so the empty state and no banner.
  const rowan = await patientRef(PATIENTS.northOne);
  await page.goto(`/patients/${rowan}`);
  await expect(alertSlot.getByText("No unresolved demo safety alerts on this patient's drafts.")).toBeVisible();
  await expect(banner).toHaveCount(0);

  await createDraft(page, PATIENTS.northOne, MEDICATIONS.zentoril);

  await page.getByRole("button", { name: "Run safety check" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Safety check complete" })).toContainText("1 blocking");
  await expect(page.getByRole("list", { name: "Safety alerts" }).getByText("Blocking", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Acknowledge advisory alert" })).toHaveCount(0);

  await page.getByRole("checkbox").check();
  await expect(page.getByTestId("sign-button")).toBeDisabled();
  await expect(page.getByTestId("sign-button")).toHaveText("Blocking alert: change or cancel the draft");
  await expect(page.getByRole("list", { name: "Signing prerequisites" })).toContainText("blocking demo alert");

  // Rowan Testcase's chart: the draft was created today (UTC), so the title says "today's order".
  await page.goto(`/patients/${rowan}`);
  await expect(page.getByRole("main").getByRole("heading", { level: 1 })).toContainText(/Rowan|Testcase/);
  await expect(banner.first()).toBeVisible();
  await expect(alertSlot.getByText("Allergy conflict on pending order")).toHaveCount(0);
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
  await expect(page).toHaveURL(new RegExp(`/patients/${rowan}/prescriptions/${REF}$`));
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

  // At 390px the toast sits over the top bar and never covers the review panel's actions.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByLabel("Quantity").fill("40");
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page.getByText("Saved version 2")).toBeVisible();
  await expectAnnounced(page, /Draft saved as version 2\./, "Save draft");
  await expectFocusOnHeading(page, "Review prescription", "Save draft");
  await expect(toasts(page)).toHaveText(["Draft saved."]);
  await expectSingleAnnouncer(page, /Draft saved/, "Save draft");
  await expect(toasts(page).getByRole("button", { name: "Dismiss: Draft saved", exact: true })).toBeVisible();
  const toastBox = (await toasts(page).first().boundingBox())!;
  for (const [label, button] of [
    ["Save draft", page.getByRole("button", { name: "Save draft" })],
    ["Sign", page.getByTestId("sign-button")],
  ] as const) {
    await button.scrollIntoViewIfNeeded();
    const b = (await button.boundingBox())!;
    const now = (await toasts(page).first().boundingBox()) ?? toastBox;
    const overlap = now.x < b.x + b.width && b.x < now.x + now.width && now.y < b.y + b.height && b.y < now.y + now.height;
    expect(overlap, `toast covers ${label}`).toBe(false);
  }
  await page.setViewportSize({ width: 1280, height: 720 });

  await trigger.click();
  await dialog.getByLabel("Reason (optional)").fill("Entered in error (synthetic)");
  await dialog.getByRole("button", { name: "Cancel draft" }).click();
  await expect(page.getByText("cancelled", { exact: true })).toBeVisible();
  await expectAnnounced(page, /cancelled/i, "Cancel");
  await expectFocusOnHeading(page, "Cancelled", "Cancel");
  await expect(page.getByRole("main").getByRole("status").filter({ hasText: "Draft cancelled." })).toHaveCount(1);
  await expect(toasts(page).filter({ hasText: "Draft cancelled." })).toHaveCount(1);
  await expectSingleAnnouncer(page, /Draft cancelled/, "Cancel");
  await expect(page.getByText("This draft was cancelled.")).toBeVisible();
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
