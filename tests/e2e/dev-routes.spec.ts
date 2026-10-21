import { expect, test, type Page } from "@playwright/test";
import { signIn } from "./helpers";

// Runs against the production build: development specimens and their query modes must not exist.
const DEV_URLS = [
  "/dev",
  "/dev/error",
  "/dev/error?kind=client",
  "/dev/shell",
  "/dev/chart",
  "/dev/prescribing",
  "/dev/components",
  "/dev/theme",
  "/dev/chart?skeleton=1",
  "/dev/chart?delay=2000",
  "/dev/prescribing?skeleton=1",
  "/dev/prescribing?delay=2000",
  "/dev/audit",
  "/dev/audit?view=empty",
  "/dev/audit?skeleton=1",
  "/dev/audit?delay=2000",
];

async function expectAllNotFound(page: Page): Promise<void> {
  for (const url of DEV_URLS) {
    const started = Date.now();
    const response = await page.request.get(url, { maxRedirects: 0 });
    expect.soft(response.status(), url).toBe(404);
    expect.soft(await response.text(), url).not.toMatch(/data-skeleton|Development specimen|Specimen failure/);
    expect.soft(Date.now() - started, `${url} ignores ?delay`).toBeLessThan(1500);
  }
}

test("development-only routes return 404 when signed out", async ({ page }) => {
  await expectAllNotFound(page);
});

test("development-only routes return 404 when signed in", async ({ page }) => {
  await signIn(page, "clinicianA");
  await expectAllNotFound(page);
});

test("development-only routes return 404 for an administrator", async ({ page }) => {
  await signIn(page, "admin");
  await expectAllNotFound(page);
});
