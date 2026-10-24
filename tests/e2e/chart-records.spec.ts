import { expect, test } from "@playwright/test";
import { MEDICATIONS, PATIENTS } from "../../scripts/fixtures.ts";
import { patientRef, REF } from "../helpers/refs";
import { signIn } from "./helpers";

// Each test leaves the seeded rows as it found them where it can (a reopened diagnosis is resolved
// again); notes and renewal drafts are new rows, and drafts go at the next global reset.

test("chart shows vitals, the HbA1c chart and diagnoses; a diagnosis reopens and resolves again", async ({ page }) => {
  await signIn(page, "clinicianA");
  await page.goto(`/patients/${await patientRef(PATIENTS.northOne)}`);

  const vitals = page.getByRole("region", { name: "Vitals" });
  await expect(vitals.locator("[data-vital]")).toHaveCount(4);
  await expect(vitals).toContainText("illustrative demo rules");
  await expect(page.locator("[data-hba1c-chart] [data-chart-point]")).toHaveCount(6);

  const table = page.getByRole("table", { name: "Diagnoses" });
  const name = "J06.9 Acute upper respiratory infection, unspecified";
  const row = table.getByRole("row").filter({ hasText: "J06.9" });
  await table.getByRole("button", { name: `Reopen ${name}` }).click();
  await expect(table.getByRole("status").filter({ hasText: "Diagnosis reopened." })).toBeVisible();
  await expect(row).toContainText(/active/i);
  await expect(table.getByRole("button", { name: `Resolve ${name}` })).toBeVisible();

  await page.reload();
  await expect(row).toContainText(/active/i);
  await table.getByRole("button", { name: `Resolve ${name}` }).click();
  await expect(table.getByRole("status").filter({ hasText: "Diagnosis resolved." })).toBeVisible();
  await expect(row).toContainText(/resolved/i);
  await expect(table.getByRole("button", { name: `Reopen ${name}` })).toBeVisible();
});

test("an encounter note autosaves, says Saved only after the save, and is there after a reload", async ({ page }) => {
  await signIn(page, "clinicianA");
  await page.goto(`/patients/${await patientRef(PATIENTS.northTwo)}`);
  const note = page.getByRole("textbox", { name: "Your note for today" });
  const state = page.locator("[data-save-state]");
  const body = `Synthetic e2e note ${Date.now()}.`;

  await note.fill(body);
  await expect(state).toContainText("Unsaved changes");
  await expect(state).toContainText(/Saved \d\d:\d\d UTC/, { timeout: 15_000 });

  await page.reload();
  await expect(note).toHaveValue(body);
  await expect(state).toHaveAttribute("data-save-state", "clean");
});

test("Renew opens a new draft prefilled from the signed prescription", async ({ page }) => {
  await signIn(page, "clinicianA");
  const ref = await patientRef(PATIENTS.northOne);
  await page.goto(`/patients/${ref}`);
  const medications = page.getByRole("list", { name: "Active medications" });
  await medications.getByRole("link", { name: /^Renew Ploxidrin/ }).click();

  await expect(page).toHaveURL(new RegExp(`/patients/${ref}/prescriptions/new\\?renew=${REF}$`));
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Renew prescription");
  await expect(page.locator('input[name="medicationId"]')).toHaveValue(MEDICATIONS.ploxidrin);
  await expect(page.getByLabel("Dose amount")).toHaveValue("100");
  await page.getByRole("button", { name: "Create draft" }).click();
  await expect(page).toHaveURL(new RegExp(`/patients/${ref}/prescriptions/${REF}$`));
});

test("a critical latest vital raises a chart banner for Elliot; Rowan's warning and a stable patient get none", async ({ page }) => {
  await signIn(page, "clinicianA");
  const slot = page.getByRole("region", { name: "Demo safety alerts" });
  const banner = slot.locator("[data-severity]").filter({ has: page.locator("[data-abnormal-vitals]") });

  await page.goto(`/patients/${await patientRef(PATIENTS.northTwo)}`);
  await expect(banner).toHaveAttribute("data-severity", "critical");
  await expect(banner).toContainText("Critical vital sign on the latest reading: SpO₂");
  await expect(banner.locator("[data-vital=spo2]")).toContainText("SpO₂ 91%: Critical (DEMO-V005)");
  await expect(banner.locator("[data-vital=heart_rate]")).toContainText("Heart rate 108 bpm: Warning (DEMO-V002)");
  await expect(slot.locator("[data-severity]").first()).toContainText("Critical vital sign");

  await page.goto(`/patients/${await patientRef(PATIENTS.northOne)}`);
  const vitals = page.getByRole("region", { name: "Vitals" });
  await expect(vitals.locator("[data-vital=blood_pressure] [data-vital-status]")).toHaveText("Warning");
  await expect(page.locator("[data-abnormal-vitals]")).toHaveCount(0);

  await page.goto(`/patients/${await patientRef(PATIENTS.northThree)}`);
  await expect(page.getByRole("region", { name: "Vitals" }).locator("[data-vital]")).toHaveCount(4);
  await expect(page.locator("[data-abnormal-vitals]")).toHaveCount(0);
});

test("chart load keeps CLS below 0.05 with a vitals banner, a draft banner or none, at 1440, 1024 and 390px", async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as typeof window & { __cls?: number };
    w.__cls = 0;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as (PerformanceEntry & { value: number; hadRecentInput: boolean })[]) {
        if (!entry.hadRecentInput) w.__cls! += entry.value;
      }
    }).observe({ type: "layout-shift", buffered: true });
  });
  await signIn(page, "clinicianA");
  const cases = [
    ["Elliot (critical vitals banner)", PATIENTS.northTwo],
    ["Rowan (draft banner if one is open, no vitals banner)", PATIENTS.northOne],
    ["northThree (no banners)", PATIENTS.northThree],
  ] as const;
  for (const width of [1440, 1024, 390]) {
    await page.setViewportSize({ width, height: 900 });
    for (const [name, id] of cases) {
      await page.goto(`/patients/${await patientRef(id)}`);
      await expect(page.getByRole("region", { name: "Vitals" })).toBeVisible();
      await page.waitForTimeout(1000);
      const cls = await page.evaluate(() => (window as typeof window & { __cls?: number }).__cls ?? 0);
      const banners = await page.getByRole("region", { name: "Demo safety alerts" }).locator(":scope > [data-severity]").count();
      console.log(`CLS ${name} at ${width}px: ${cls.toFixed(4)} (${banners} banner${banners === 1 ? "" : "s"})`);
      expect.soft(cls, `${name} at ${width}px`).toBeLessThan(0.05);
    }
  }
});

test("Elliot's critical SpO2 makes his queue chip critical", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page, "clinicianA");
  const chip = page.getByRole("navigation", { name: "Today's queue" }).filter({ visible: true }).locator(`[data-queue-item="${PATIENTS.northTwo}"]`);
  await expect(chip.locator("[data-status]")).toHaveAttribute("data-status", "critical");
  await expect(chip).toHaveAccessibleName(/, Critical alert$/);
});
