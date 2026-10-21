import { expect, test, type Page } from "@playwright/test";

const FAILURE = "Specimen failure: Testcase, Rowan SYN-000101";

async function expectGenericErrorPage(page: Page): Promise<string> {
  const alert = page.getByRole("main").getByRole("alert");
  await expect(alert).toContainText("Something went wrong");
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
  const reference = page.getByTestId("error-reference");
  await expect(reference).toHaveText(/^Reference: [0-9A-Za-z]{1,10}$/);
  await expect(page.locator("body")).not.toContainText("Testcase");
  await expect(page.locator("body")).not.toContainText("Specimen failure");
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
  return (await reference.textContent()) ?? "";
}

test("server error: generic alert with the digest reference and no error text", async ({ page }) => {
  const reported: string[] = [];
  page.on("request", (request) => {
    if (request.method() === "POST" && request.headers()["next-action"]) reported.push(request.url());
  });
  await page.goto("/dev/error");
  await expectGenericErrorPage(page);
  expect(reported, "server errors are logged by instrumentation, not re-sent from the browser").toEqual([]);
});

test("browser error: name and stack go to the server log without the message; its reference is shown", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error" && message.text().includes(FAILURE)) consoleErrors.push(message.text());
  });
  const report = page.waitForRequest((request) => request.method() === "POST" && Boolean(request.headers()["next-action"]));

  await page.goto("/dev/error?kind=client");
  const body = (await report).postData() ?? "";
  expect(body, "the message can hold patient data").not.toContain("Specimen failure");
  expect(body).not.toContain("Testcase");
  expect(body, "route pattern only, never the query string").toContain('"route":"/dev/error"');

  const reference = await expectGenericErrorPage(page);
  expect(reference).toMatch(/^Reference: [0-9A-F]{10}$/);
  expect(body).toContain(`"reference":"${reference.replace("Reference: ", "")}"`);
  // React and Next report uncaught errors to the console in development; the app adds nothing.
  expect(consoleErrors.filter((text) => text.startsWith("[kestrel]"))).toEqual([]);
});

test("Try again re-renders the segment", async ({ page }) => {
  await page.goto("/dev/error");
  await expectGenericErrorPage(page);
  await page.getByRole("button", { name: "Try again" }).click();
  // The specimen fails every time, so the boundary shows again rather than the page.
  await expect(page.getByRole("main").getByRole("alert")).toBeVisible();
});
