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

/** Hides the Next.js development overlay so it is not measured or screenshotted. */
export async function hideDevOverlay(page: Page): Promise<void> {
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
}
