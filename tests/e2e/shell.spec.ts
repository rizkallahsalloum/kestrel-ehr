import { expect, test } from "@playwright/test";
import { PATIENTS } from "../../scripts/fixtures.ts";
import { QUEUE_STATUS_LABEL, queueStatus, type QueueStatus } from "../../src/features/patients/queue.ts";
import { patientRef } from "../helpers/refs";
import { clientFor } from "../helpers/supabase";
import { signIn, signOut } from "./helpers";

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

  const elliot = await patientRef(PATIENTS.northTwo);
  const rowan = await patientRef(PATIENTS.northOne);
  await queue.locator(`[data-queue-item="${PATIENTS.northTwo}"]`).click();
  await expect(page).toHaveURL(new RegExp(`/patients/${elliot}$`));
  await expect(queue.locator(`[data-queue-item="${PATIENTS.northTwo}"]`)).toHaveAttribute("aria-current", "page");
  await expect(queue.locator("[aria-current]")).toHaveCount(1);
  await expect(page.getByRole("link", { name: "Back to patients" })).toHaveCount(0);

  await queue.locator(`[data-queue-item="${PATIENTS.northOne}"]`).click();
  await expect(page).toHaveURL(new RegExp(`/patients/${rowan}$`));
  await expect(queue.locator(`[data-queue-item="${PATIENTS.northOne}"]`)).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("main").getByRole("heading", { level: 1 })).toContainText("Testcase");

  // The rail follows the current patient.
  const rail = page.getByRole("navigation", { name: "Main" });
  await expect(rail.getByRole("link", { name: "Chart" })).toHaveAttribute("href", `/patients/${rowan}`);
  await expect(rail.getByRole("link", { name: "E-Rx" })).toHaveAttribute("href", `/patients/${rowan}/prescriptions/new`);
});

/**
 * Seeded baseline (no prescriptions after the global reset): Rowan has an active severe allergy
 * (critical), Elliot a latest SpO2 of 91% (critical under DEMO-V005), Jordan an active moderate
 * allergy (warning); Morgan and Casey are stable. Drafts made by other e2e tests can raise a state,
 * so the expectation is the queue status function applied to what the clinician's own session
 * reads; the allergy and vitals floors hold whatever the drafts are.
 */
test("Today's queue dots follow the queue status function for every seeded patient", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const cases = [
    { key: "clinicianA", patients: [PATIENTS.northOne, PATIENTS.northTwo, PATIENTS.northThree] },
    { key: "clinicianB", patients: [PATIENTS.southOne, PATIENTS.southTwo] },
  ] as const;
  const floors: Record<string, QueueStatus> = {
    [PATIENTS.northOne]: "critical",
    [PATIENTS.northTwo]: "critical",
    [PATIENTS.southOne]: "warning",
  };
  const rank: Record<QueueStatus, number> = { stable: 0, warning: 1, critical: 2 };
  for (const { key, patients } of cases) {
    const client = await clientFor(key);
    const { data, error } = await client
      .from("patients")
      .select(
        "id, allergies(severity), prescriptions(status, version, last_evaluated_version, prescription_alerts(prescription_version, severity, decision:prescription_safety_decisions(id))), vital_readings(heart_rate, systolic, diastolic, spo2, temperature_f, recorded_at)",
      )
      .in("id", [...patients])
      .eq("allergies.status", "active")
      .eq("prescriptions.status", "draft")
      .is("prescriptions.prescription_alerts.resolved_at", null)
      .order("recorded_at", { referencedTable: "vital_readings", ascending: false })
      .limit(1, { referencedTable: "vital_readings" });
    expect(error).toBeNull();
    expect(data).toHaveLength(patients.length);

    await signIn(page, key);
    const queue = page.getByRole("navigation", { name: "Today's queue" }).filter({ visible: true });
    for (const row of data!) {
      const expected = queueStatus({ drafts: row.prescriptions, allergies: row.allergies, vitals: row.vital_readings[0] ?? null });
      if (floors[row.id]) expect(rank[expected]).toBeGreaterThanOrEqual(rank[floors[row.id]!]);
      const chip = queue.locator(`[data-queue-item="${row.id}"]`);
      await expect(chip.locator("[data-status]")).toHaveAttribute("data-status", expected);
      await expect(chip).toHaveAccessibleName(new RegExp(`, ${QUEUE_STATUS_LABEL[expected]}$`));
      if (row.id === PATIENTS.northOne) {
        // Rowan's active severe allergy: a plain critical dot, no ring.
        const dot = await chip.locator("[data-status]").evaluate((el) => {
          const probe = document.createElement("div");
          probe.style.backgroundColor = "var(--color-status-critical)";
          document.body.append(probe);
          const critical = getComputedStyle(probe).backgroundColor;
          probe.remove();
          const cs = getComputedStyle(el);
          return { fill: cs.backgroundColor, critical, outline: cs.outlineStyle };
        });
        expect(dot.fill).toBe(dot.critical);
        expect(dot.outline).toBe("none");
      }
    }
    await signOut(page);
  }
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
