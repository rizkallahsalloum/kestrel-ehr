import { expect, test } from "@playwright/test";

// Every component pairing on /dev/components must meet its minimum. Exempt rows are references for
// colours deliberately not used in that role ("(not used …)"); they stay visible in the table and the log.
test("component colour pairings meet their contrast minimums", async ({ page }) => {
  await page.goto("/dev/components");
  const rows = page.locator("table tbody tr");
  await expect(rows.first().getByTestId("contrast-ratio")).toBeVisible();

  const results = await rows.evaluateAll((trs) =>
    trs.map((tr) => {
      const cells = (tr as HTMLTableRowElement).cells;
      const ratio = cells[3]?.querySelector("[data-testid='contrast-ratio']");
      return {
        label: cells[0]?.textContent ?? "",
        ratio: ratio?.textContent ?? "missing",
        pass: ratio?.getAttribute("data-pass") === "true",
      };
    }),
  );
  console.log(results.map((r) => `${r.label} => ${r.ratio}`).join("\n"));

  const failures = results.filter((r) => !r.pass && !/\(not used/.test(r.label));
  expect(failures).toEqual([]);

  const marker = results.filter((r) => r.label.startsWith("Rail current marker:"));
  expect(marker).toHaveLength(2);
  for (const row of marker) expect(parseFloat(row.ratio), row.label).toBeGreaterThanOrEqual(3);
});
