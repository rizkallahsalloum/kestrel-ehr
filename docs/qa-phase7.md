# Phase 7 QA report (frontend plan F6)

Run on 21 Oct 2026 on Windows 10, Chromium from Playwright, against the development-only specimens (`/dev/*`, no Supabase) and, for e2e, the hosted `kestrel-test` project. Kestrel EHR is a synthetic-data prototype; nothing here is a claim of accessibility conformance. Only checks listed under "Ran and passed" ran. Everything else is labelled **unverified, not passed**.

## Decisions applied

- **Audit table.** Stacked cards at 760px and below, full table above (`md` starts at 761px). Native `<table>` markup with explicit `role` attributes (`table`, `rowgroup`, `row`, `columnheader`, `cell`), because the narrow layout sets `display: block` on the table parts. The header row is visually hidden below `md`; each cell shows its column name as a visible label that is hidden from assistive technology. The audit skeleton changes at the same width.
- **Widths.** Layout specs run at 1440, 1281, 1280, 1181, 1180, 1024, 821, 820, 761, 760 and 390px (`tests/browser/support.ts`). **Plan versus rules:** the frontend plan (section 5) gives `md` as 760px; the rules file and the code use 761px, so 760px is the last single-column width and 761px the first wider one. Tests follow the rules file.
- **Screenshots.** No screenshot comparison. Review screenshots and axe findings go to `review-screenshots/` (gitignored).

## Ran and passed

| Check | Result |
| --- | --- |
| `pnpm typecheck`, `pnpm lint` | clean |
| `pnpm test:unit` | 170 passed |
| `pnpm test:browser` (all specs) | 199 passed |
| `pnpm build`, then `pnpm check:bundle` | build passed; client bundle clean (33 files scanned) |
| `pnpm test:db` (kestrel-test) | 46 passed |
| `pnpm test:int` (kestrel-test) | 18 passed |
| `pnpm test:e2e` (kestrel-test) | 16 passed on the second run; see below |

**e2e first run:** 13 passed, 3 failed. Two sign-in tests did not show the signed-in user within 15s and one page load hit the 60s test timeout. Nothing in the code under test had changed between the runs. These failures match the hosted-latency failures seen in earlier phases. The re-run passed 16 of 16 with no changes in between. Treat this as a flaky hosted environment, not a proven pass under load.

### What the browser specs cover

- **Audit table** (`audit.spec.ts`, `loading.spec.ts`): no horizontal overflow, columns side by side above 760px, stacked cards with visible field labels at 760px and below, the action badge uses the accent colour (not red), empty state. Skeleton boxes (heading, intro, card, first row, six header cells above 760px) match the loaded table at every width; layout shift on stream-in stays under 0.05.
- **`/dev/audit`** returns 404 in the production build, signed out and signed in as clinician and administrator, including `?view=empty`, `?skeleton=1` and `?delay=2000` (`tests/e2e/dev-routes.spec.ts`).
- **axe-core** (`a11y.spec.ts`, `@axe-core/playwright` 4.14, all default rules): 29 specimen pages and views, six of them also at 390px, plus five interactive states. The states are the components dialog open, the cancel-draft dialog open, errors shown after a submit, and the combobox expanded on `/dev/components` and on the new-prescription form. The error screens are covered by `/dev/error`, `/dev/error?kind=client`, `/dev/shell?view=error` and `?view=not-found`. Serious or critical findings fail the test: **none**. The same spec checks that no live region is nested inside another.
- **Focus rings** (`keyboard.spec.ts`): Tab through the rail, top bar and patient list (1440 and 390px), the admin rail, the sign-in form, the new-prescription form (tracker, combobox, sentence controls, fields), the saved-draft review panel, the dialog and an invalid field. Every stop has an outline or field ring of at least 3:1 against the colours next to it (measured 4.95 to 16.01), and field rings must differ from the unfocused border. Colour transitions are switched off during measurement so the settled state is measured.
- **Combobox in a real browser:** focus opens the list; ArrowDown and ArrowUp move `aria-activedescendant` and `aria-selected`, wrapping at both ends; focus stays in the input. Typing filters and announces "2 results available."; Enter picks; Escape restores the chosen label; no-match text; Tab closes. The listbox is named by the field label.
- **Section tracker:** three links in order, each name says "(complete)" or "(not complete)". Enter on "Directions" moves focus to the Directions section (named by its heading), with its top below the sticky top bar at 1440 and 390px; the next Tab reaches the first field. Enter on "Review" focuses the review panel.
- **Error announcements:** after a submit, each message appears once in its own `role="alert"` (one form-level, one field-level that is also the field's description). Submitting again adds no duplicates, and no live region is nested. Chart alert banners are static on load (no `role="alert"`, under the "Demo safety alerts" heading, blocking first). Error screens show one alert.
- **Reduced motion** (`motion.spec.ts`, `prefers-reduced-motion: reduce` emulated): skeleton bars on the chart, prescribing and audit skeletons have no animation; chart fade-ins have a duration under 0.01s. No animation is running on the chart, the theme motion row, an open dialog, or the combobox loading rows and spinner. A control run with motion allowed shows the skeleton pulse running, so the check can see animations.

## Fixed in this phase

- **Focused invalid fields had no visible focus change.** The orange error stroke stays while focused, and the only change was a 12% focus glow. `error-ring-focus` now adds the global 2px focus outline (measured 5.83:1).
- **Combobox listbox had no accessible name** when used inside `FormField`. `FormField` labels now have an id, and the listbox is labelled by it.
- **Tracker jumps hid the section heading at 760px and below.** The top bar wraps to two rows (112px) but sections scrolled only 78px below the top. New token `--spacing-below-topbar-stacked` (120px) is used below `md`.
- **Tracker jumps left focus on the page body.** Prescription sections and the review panel are now `tabIndex={-1}` targets, so focus moves to the named section.

## axe moderate and minor findings (listed, not failing)

| Rule | Impact | Where | Note |
| --- | --- | --- | --- |
| `region` | moderate | 3 of 40 scans, all on `/dev/components` (page, combobox expanded, errors shown) | **Resolved on app pages in the Phase 8 follow-up (21 Oct 2026).** The banner now sits inside the `header` landmark in the app shell, sign-in, status and full-page error screens; before that it was flagged on 37 of 40 scans. What remains is the banner shown on its own as a component specimen on `/dev/components`, outside any landmark by design. |
| `page-has-heading-one` | moderate | 4 skeleton views (chart, prescribing new and saved, audit) | While loading, the page content, including the heading, is `aria-hidden` and the region announces "Loading …". Expected for a skeleton. |

No minor findings. The theme and components contrast tables are excluded from axe because they deliberately render UI-only and "not used" colour pairs as sample text; `contrast.spec.ts` checks each pair against its own threshold.

## Critical-dot pulse

The task asked to assert that the critical-dot pulse stops. **No such animation exists:** `StatusDot` (critical) is static in the code, the plan and the design references. The motion spec asserts that it has no animation. If a pulse is wanted, it needs a design decision first.

## Unverified, not passed

- **Screen-reader testing** (NVDA, JAWS, VoiceOver, TalkBack): unverified, not passed. Announcement checks above inspect roles and live regions in the DOM, not real speech output.
- **Browsers other than Chromium** (Firefox, Safari, mobile browsers), and real phones and tablets: unverified, not passed.
- **Browser zoom to 200% and 400%, text-spacing overrides, Windows forced-colours (high contrast) mode:** unverified, not passed.
- **axe on the signed-in app with hosted data** (as opposed to the specimens): unverified, not passed. e2e covers behaviour, not axe.
- **Skeleton geometry and layout shift with hosted data:** unverified, not passed (specimens only).
- **Touch target sizes** beyond what axe checks: unverified, not passed.
