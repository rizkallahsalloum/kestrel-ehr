import path from "node:path";
import type { Page } from "@playwright/test";

/**
 * Widths every layout spec checks: the plan's review widths plus both sides of each breakpoint
 * (`md` 761, `erx` 821, `workspace` 1181, `erx-wide` 1281; see docs/theme.md).
 */
export const LAYOUT_WIDTHS = [1440, 1281, 1280, 1181, 1180, 1024, 821, 820, 761, 760, 390] as const;

/** Where review screenshots go: gitignored, kept between runs, never compared against a baseline. */
export const REVIEW_DIR = path.join("review-screenshots");

/** Path for a review screenshot file. */
export function reviewPath(folder: string, file: string): string {
  return path.join(REVIEW_DIR, folder, file);
}

/** Saves a full-page screenshot for manual review. Not an assertion. */
export async function reviewScreenshot(page: Page, folder: string, name: string): Promise<void> {
  await page.screenshot({ path: reviewPath(folder, `${name}.png`), fullPage: true, caret: "initial" });
}

/**
 * Severity colour rule (docs/theme.md, "Severity colours"): every element in `main` painted with an
 * error (red) token must sit inside a `[data-severity=critical]` state, and no element inside one may
 * use a warning (orange) token. Text, background, visible top border and SVG stroke are checked.
 * Dialogs are skipped: the "Cancel draft" confirm is the one destructive red and has its own test.
 */
export async function severityColourViolations(page: Page): Promise<{ redOutsideCritical: string[]; orangeInCritical: string[] }> {
  return page.evaluate(() => {
    const probe = document.createElement("div");
    document.body.append(probe);
    const resolve = (tokens: string[]) =>
      tokens.map((t) => {
        probe.style.color = `var(--color-${t})`;
        return getComputedStyle(probe).color;
      });
    const red = resolve(["danger", "danger-ink", "danger-subtle", "danger-line", "status-critical"]);
    const orange = resolve(["warning", "warning-subtle", "warning-line", "warning-stroke", "status-warning"]);
    probe.remove();
    const painted = (el: Element): string[] => {
      const s = getComputedStyle(el);
      const colours = [s.backgroundColor];
      if (el.childElementCount === 0 || el instanceof SVGElement) colours.push(s.color);
      if (parseFloat(s.borderTopWidth) > 0) colours.push(s.borderTopColor);
      return colours;
    };
    const describe = (el: Element) => el.outerHTML.slice(0, 120);
    const redOutsideCritical: string[] = [];
    const orangeInCritical: string[] = [];
    for (const el of document.querySelectorAll("main *")) {
      if (el.closest("dialog")) continue;
      const colours = painted(el);
      const severity = el.closest("[data-severity]")?.getAttribute("data-severity");
      if (colours.some((c) => red.includes(c)) && severity !== "critical") redOutsideCritical.push(describe(el));
      if (colours.some((c) => orange.includes(c)) && severity === "critical") orangeInCritical.push(describe(el));
    }
    return { redOutsideCritical, orangeInCritical };
  });
}

/** Hides the Next.js development overlay so it is not measured or screenshotted. */
export async function hideDevOverlay(page: Page): Promise<void> {
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
}
