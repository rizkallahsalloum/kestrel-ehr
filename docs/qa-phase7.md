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

## Phase 8b note: Privacy mode masks fields in place (22 Oct 2026)

The Phase 8 overlay ("Content hidden" card over a scrim, "Show content" button, inert content area) is gone. Privacy mode now masks patient values in place with `PrivateText` and `PrivateField`; see [theme.md](theme.md#privacy-mode-phase-8-in-place-masking-since-phase-8b). It is still client-side shoulder-surfing protection: values remain in the RSC payload, in server HTML until hydration, and in form control values. The server-rendered alternative is not built.

| Check | Result |
| --- | --- |
| `pnpm typecheck`, `pnpm lint` | clean |
| `pnpm test:unit` | 196 passed |
| `pnpm test:browser` (all specs) | 211 passed, including 12 in `privacy.spec.ts` |
| `pnpm build`, then `pnpm check:bundle` | build passed; client bundle clean (34 files scanned) |
| `pnpm test:e2e` (kestrel-test) | 17 passed on the first run, including the updated Privacy sign-out/sign-in case |

`test:db` and `test:int` were not re-run (no database or Server Action changes).

- **axe** on `/dev/privacy` with values shown, masked and one revealed, at 1440 and 390px: no findings of any impact.
- **Contrast** (`contrast.spec.ts`, rows on `/dev/components`): form-field mask `ink-strong` on `surface-warm` 5.50:1, field edge 3.25:1 (UI), `ink-muted` on `surface` 5.24:1, link `accent` 5.89:1, alert `ink-strong` on `warning-subtle` 5.66:1. All pass.
- **Found and fixed while testing:** the patient-list search summary showed the query ("1 patient matches “Rowan”") as plain text; it is now masked. Focus could drop to the page body when the focused control became inert; it now moves to the mask.
- **Unverified, not passed:** screen-reader output of the reveal and re-mask announcements; Privacy mode in browsers other than Chromium, on macOS (⌘+.) and with an input method editor; layout shift on hosted data and for values first rendered while masked (they can move once on reveal, by design).

## Phase 8c note: shell polish, Today's queue and severity colours (22 Oct 2026)

Code commit `8f7acd8`. Severity colour rule changed: red (error tokens) for severe and critical, orange for moderate and warning, green for stable, triangle icon only; see [theme.md](theme.md#severity-colours-phase-8c-replaces-the-phase-5-red-and-orange-rule), which lists every place red appears. New: account menu (Privacy auto-hide 30 s / 1 min / 2 min, Sign out), Today's queue, sync status, Privacy pill, rail with Schedule / Labs / Billing placeholders, global cursor rule, shared `getInitials`. "Back to patients" and the Sign out button are gone.

| Check | Result |
| --- | --- |
| `pnpm typecheck`, `pnpm lint` | clean |
| `pnpm test:unit` | 32 files, 253 passed |
| `pnpm test:browser` (all specs) | 229 passed, including the new `top-bar.spec.ts` |
| `pnpm build`, then `pnpm check:bundle` | build passed; client bundle clean (35 files scanned) |
| `pnpm test:e2e` (kestrel-test) | 19 passed on the first run, including queue switching and the placeholder pages |

`test:db` and `test:int` were not re-run (no migrations; the only new query, `listMyQueue`, is a read under existing RLS and is covered by e2e).

- **Severity tests.** The Phase 5 "no detection state is red" assertions were replaced: every severity surface carries `data-severity`, and `severityColourViolations` fails a page if red appears outside a `critical` surface or orange inside one, on every chart and prescribing view.
- **axe** on every specimen plus: placeholder page, account menu open, Privacy on with the queue masked, and offline sync status, at 1440 and 390px: no serious or critical findings.
- **Contrast**: new rows for danger tokens at 12px, the Privacy pill, account menu, queue chips and dots, and the sync line; all pass (see theme.md).
- **Found and fixed while testing:** the queue chips' visually hidden status labels escaped the scrolling list and widened every page by 220px (the list now clips them); axe flagged the account-menu trigger because its `aria-label` left out the avatar initials (the name now comes from the content); the role text failed contrast on the hover fill (now `ink-secondary`); the chart skeleton's allergy pill was narrower than the real one, so only the real hero wrapped at 761px.
- **Known issue, not fixed:** with Privacy on, wrapped medication names in the chart prescriptions table at 390px collapse to a one-line mask, so the table gets shorter (55px on the specimen). Phase 8b trade-off; see theme.md "Known issues". The top bar, queue and hero do not move.
- **Unverified, not passed:** screen-reader output of the account menu, queue names and offline announcements; the account menu and popover in browsers other than Chromium; the real `online` / `offline` events on a device (tests use Playwright's offline emulation); queue freshness across two tabs or users (only revalidation after this user's own mutations is in place); axe on hosted data.

## Phase 8d note: top bar layout, Privacy button and queue statuses (22 Oct 2026)

Code commit `d4ed977`. Today's queue has its own row under the search and controls (a single item sits inline from 1440px) and wraps instead of scrolling sideways; the sticky offsets follow the bar's computed height. The Privacy button is a ghost button between the sync status and the account menu ("Privacy on" in green). Queue statuses: critical for an unresolved blocking alert on a current draft, warning for an unresolved advisory or a draft with no safety check on its saved version, stable otherwise. Follow-ups from 8c: the allergies card is back to the normal border weight, and the account-menu and queue-chip accessible names have no stray spaces. Fixed: the patient header showed "••••••unknown" with Privacy on (age and sex are now one masked value), and the "Schedule" rail label was clipped (rail items are wider). Details in [theme.md](theme.md#phase-8d-top-bar-layout-privacy-button-queue-statuses).

| Check | Result |
| --- | --- |
| `pnpm typecheck`, `pnpm lint` | clean |
| `pnpm test:unit` | 32 files, 257 passed |
| `pnpm test:browser` (all specs) | 258 passed |
| `pnpm build`, then `pnpm check:bundle` | build passed; client bundle clean (35 files scanned) |
| `pnpm test:e2e` (kestrel-test) | 19 passed on the first run |

`test:db` and `test:int` were not re-run (no migrations; the queue query is unchanged).

- **New browser tests.** Privacy button: ghost at rest, hover fill, off and on colours, icons, focus ring, unchanged size, and its position (after the sync status, immediately left of the account menu) at 1440, 1024, 760 and 390px. Queue with 1, 3 and 7 patients at the same four widths: no horizontal overflow, chips inside the queue, the expected number of lines, the bar's rendered height equal to `--topbar-height`, every E-Rx section below the bar after a jump, and every sticky element's offset at least the bar's height. Statuses by case (three distinct dots and names). The patient header meta line on the chart and E-Rx pages, shown and masked. All five rail labels inside their items at 1440 and 761px. The tracker jump test now runs with 1, 3 and 7 queue patients; the skeleton layout-shift test with 1 and 3.
- **axe** on the top bar with 1, 3 and 7 queue patients and the Privacy button hovered off and on, at 1440, 1024, 760 and 390px; the account-menu / Privacy / offline scan now also runs at 1024 and 760px. No serious or critical findings.
- **Contrast**: Privacy button rows replaced (off 4.98:1 on `page`, 4.65:1 on the hover fill; on 5.31:1 / 4.95:1; focus ring 5.31:1); all pass.
- **Found and fixed while testing:** a compiled `:is()` selector made the `md` queue-column rule outrank the `xl` one, so the queue used three columns instead of five at 1180px and up (split into separate rules); the queue chips' hidden status text was a flex item, so accessible names had a space before the comma (it now sits inline after the name); the first top-bar height tokens were 5px off (now derived from tokens and checked against the rendered height).
- **Known limitation, not fixed (accepted):** with Privacy on, wrapped medication names in the chart prescriptions table at 390px collapse to a one-line mask, so the table gets shorter. See theme.md "Known issues".
- **Unverified, not passed:** screen-reader output of the new inline hidden text (`sr-only-inline`, font size 0) in NVDA, JAWS and VoiceOver; the top bar in browsers other than Chromium (CSS `round()` and `:has()` are required for the height calculation); top-bar height with real user names much longer than the demo names; hosted-data queue statuses beyond the e2e regex check.

### Phase 8d item C: queue chip avatar colours (22 Oct 2026)

Queue chip avatars are teal, green or blue (decorative; the colour carries no meaning). Red was excluded because kestrel.mdc reserves it for severe and critical states. The colour comes from `queueAvatarTones`: ids of **all** patients the queue query returns (before the six-chip cap) sorted, index mod 3; one patient is teal. Details in [theme.md](theme.md#phase-8d-top-bar-layout-privacy-button-queue-statuses).

| Check | Result |
| --- | --- |
| `pnpm typecheck`, `pnpm lint` | clean |
| `pnpm test:unit` | 32 files, 262 passed (5 new for `queueAvatarTones`) |
| `pnpm test:browser` (all specs) | 259 passed |
| `pnpm build`, then `pnpm check:bundle` | build passed; client bundle clean (36 files scanned) |
| `pnpm test:e2e` | not run: the shell structure and sign-in/out did not change (unverified, not passed for this commit; 19 passed on `d4ed977`) |

- **Browser test:** per-patient colours match the sorted-id assignment, survive a reload, stay the same when the queue is reordered (`?queueOrder=rotated`, which also changes which patient is behind "View all"), stay when masked (initials become "••"), and with one patient the chip is teal; chip text, accessible names and the queue's accessibility tree never mention a colour.
- **axe:** the reordered queue was added to the top-bar scan at 1440, 1024, 760 and 390px. No serious or critical findings.
- **Contrast:** white initials at 11px on teal 5.98:1, green 5.93:1, blue 6.46:1; all pass.
- **Unverified, not passed:** e2e on kestrel-test for this commit; how the colours look to people with colour-vision deficiencies (no simulation run; the colour has no meaning, so nothing depends on telling them apart); colours with hosted patient ids (the assignment is unit-tested and the ids are UUIDs, so the order is arbitrary but stable).

## Phase 8e note: queue statuses with allergies, queue position, page width, account trigger, button states (22 Oct 2026)

Queue dots now also count active allergies (severe makes a patient critical, moderate a warning; mild alone stays stable). The queue sits on the search row when its items fit (measured per item count; six chips from 2390px, so **not at 1280px**), otherwise on its own row as in 8d. Every page is fluid up to 1760px (cap removed in Phase 8f: main now shares the top bar's full width and padding). The Privacy label is 8px (`xs`) from its icon. Only the avatar and chevron open the account menu ("Account menu, <name>"); the name and "Clinician · Cedar Park" are plain text. Buttons, including links styled as buttons, have a visible hover and a darker pressed state. Details in [theme.md](theme.md#phase-8e-queue-statuses-with-allergies-queue-position-page-width-account-trigger-button-states).

| Check | Result |
| --- | --- |
| `pnpm typecheck`, `pnpm lint` | clean |
| `pnpm test:unit` | 32 files, 266 passed (4 new allergy cases) |
| `pnpm test:browser` (all specs) | 283 passed (after one fix below; the first full run had 282 passed, 1 failed) |
| `pnpm build`, then `pnpm check:bundle` | build passed; client bundle clean (36 files scanned) |
| `pnpm test:e2e` (kestrel-test) | 20 passed on the first run (new: queue dots for all five seeded patients) |

`test:db` and `test:int` were not re-run (no migrations; the queue query only gained an embedded `allergies` read under the existing RLS, which e2e exercises for both teams).

- **Seeded queue states** (prescriptions are reset before e2e): Rowan Testcase critical (active severe DEMO-ALPHA allergy; her mild allergy is inactive), Jordan Mockridge warning (active moderate DEMO-GAMMA), Elliot Samplewood, Morgan Fixture and Casey Placeholder stable (no allergies). The e2e test computes each expectation with `queueStatus` from what the clinician's own session reads, so drafts made by other e2e tests cannot make it flaky, and it asserts the allergy floors.
- **New browser tests** (`top-bar-layout.spec.ts`): six chips at 1280, 1440, 1920, 2389, 2390 and 2560px with Privacy off and on; page width, rail and chart columns at 760 to 2560px; the Privacy gap at 820 and 1440px and icon-only at 819px; trigger size, name, children and initials; hover and pressed computed styles on every variant, disabled buttons unchanged, no transition under reduced motion, no hover on a touch device. The queue wrap loop also runs at 2560px.
- **axe:** top bar at 2560px (inline queue), the account trigger hovered, every button variant hovered and pressed, the button-styled link hovered. No serious or critical findings.
- **Contrast:** primary hover 7.48:1, pressed 16.24:1; danger hover 4.99:1, pressed 9.75:1; secondary and quiet pressed 11.51:1; link pressed 8.68:1; all pass.
- **Found and fixed while testing:** axe `label-content-name-mismatch` on the new trigger (the avatar initials were its only visible text and are not in "Account menu, <name>"; they are now CSS generated content of the decorative avatar); the chart skeleton's allergy-badge placeholder was 1px too wide for one row at 761px once the page padding became `lg` (24px), so the skeleton hero wrapped while the chart did not (placeholder narrowed); the Privacy label gap came from the button's centred text inside the shared label cell.
- **Unverified, not passed:** the inline queue with real names on hosted data at 2390px and up (specimens only; chips truncate rather than overflow if the controls are wider); hover on real touch devices (Playwright touch emulation only); speech-input use of the trigger ("click Account menu") with Dragon or Voice Access; the generated-content initials in Windows forced-colours mode.

## Phase 8f note: UI regression fixes (22 Oct 2026)

Today's queue chips have no outline ring at rest, on hover, when current or on mouse click; keyboard focus turns the chip's border to the `focus` colour, 2px inset (forced-colours mode keeps the outline). Only the dot carries the status colour (`bg-status-stable`, `bg-status-warning`, `bg-status-critical`, no ring); the queue status rule is unchanged (an active severe allergy is critical). `<main>` now shares the top bar's full width and padding (the 1760px cap is gone). The blocking chart banner reads "Allergy conflict on today's order", with the medication at the start of the body. Details in [theme.md](theme.md#phase-8f-ui-regression-fixes-queue-chips-content-width-alert-banner).

| Check | Result |
| --- | --- |
| `pnpm typecheck`, `pnpm lint` | clean |
| `pnpm test:unit` | 32 files, 266 passed |
| `pnpm test:browser` (all specs) | 284 passed (the first full run had 283 passed, 1 failed: a stale "title starts with Blocking" assertion, updated) |
| `pnpm build`, then `pnpm check:bundle` | build passed; client bundle clean (36 files scanned) |
| `pnpm test:e2e` (kestrel-test) | 20 passed |

`test:db` and `test:int` were not re-run (no migrations or queries changed).

- **New and changed tests:** chip ring, hover, pressed, current and keyboard-focus styles and one container style for every status (`top-bar.spec.ts`); the focus border's contrast (3:1 or more, `keyboard.spec.ts`); the chart's outer edges equal the top bar's content edges within 1px at 760 to 2560px (`top-bar-layout.spec.ts`); Rowan Testcase's dot is the `status-critical` colour with no outline on kestrel-test, and no banner before a draft exists (e2e); banner title and body (`chart`, `privacy`, `keyboard` specs, e2e).
- **axe:** the existing top-bar and chart scans ran unchanged in the browser suite. No serious or critical findings.
- **Unverified, not passed:** the banner title for a blocking interaction rule (none is seeded); chips in Windows forced-colours mode; the full-width layout with real hosted data at 2560px (specimens and e2e at 1440px only).

## Phase 8f follow-up note: banner title by order date, seeded blocking draft (22 Oct 2026)

The blocking banner reads "Allergy conflict on today's order" when the draft was created on the current UTC day, otherwise "Allergy conflict on pending order"; the drug name stays in the body. `pnpm db:seed:test` now adds one blocking Zentoril draft for Rowan Testcase on kestrel-test (through the clinician's session and `evaluate_prescription_safety`; skipped when she already has a blocking draft). Unchanged on purpose (user decisions): the queue dot rule (active severe allergy critical, moderate warning, mild stable) and the queue breakpoint (second row below 2390px). Known limitation flagged for Phase 9: two blocking drafts show identical titles. Details in [theme.md](theme.md#phase-8f-follow-up-banner-title-by-order-date-seeded-blocking-draft).

| Check | Result |
| --- | --- |
| `pnpm typecheck`, `pnpm lint` | clean |
| `pnpm test:unit` | 270 passed (4 new title cases: same day, yesterday, either side of UTC midnight, an offset timestamp) |
| `pnpm test:browser` (all specs) | 284 passed |
| `pnpm build`, then `pnpm check:bundle` | build passed; client bundle clean (36 files scanned) |
| `pnpm test:e2e` (kestrel-test) | 20 passed (Rowan's chart shows "today's order" for a draft created through the app) |
| `pnpm db:seed:test` (kestrel-test) | after a prescription reset: draft created and checked (1 unresolved blocking alert on its current version); run again: none added |

`test:db` and `test:int` were not re-run (no migrations; the seed only adds a draft through existing grants). `test:int` resets prescriptions before it starts; `test:db` does not.

- **Unverified, not passed:** `test:db` with the seeded draft present on kestrel-test; the title when a request straddles UTC midnight in a real session (unit-tested only); the seeded draft after a future change to the DEMO rules.

## Phase 9 note: vitals, HbA1c, diagnoses and encounter notes (23 Oct 2026)

The chart shows a vitals band (demo status, sparkline), one HbA1c series with eAG derived by 28.7 × HbA1c − 46.7, the full diagnosis table, and encounter notes. Privacy masks the values and leaves Critical, Warning and Stable readable. Renew is a link into the normal new-draft form. Details in [theme.md](theme.md#phase-9-vitals-hba1c-diagnoses-encounter-notes).

| Check | Result |
| --- | --- |
| `pnpm typecheck`, `pnpm lint` | clean |
| `pnpm test:unit` | 37 files, 300 passed |
| `pnpm test:db` (kestrel-test) | 6 files, 59 passed |
| `pnpm test:int` (kestrel-test) | 24 passed. The first run failed one assertion: a repeated draft now also returns `patientRef` and `prescriptionRef`. The expectation was updated and the suite was re-run. |
| `pnpm test:browser` (all specs) | 298 passed |
| `pnpm build`, then `pnpm check:bundle` | build passed; client bundle clean (38 files scanned) |
| `pnpm test:e2e` (kestrel-test) | 25 passed |
| `pnpm db:seed:test` (kestrel-test), after e2e | signed prescriptions already present; Rowan already had a blocking draft (the suite's own), so none was added |

Kestrel-Dev was not written to. Migrations 0011–0015 were already on kestrel-test before this UI pass.

- **Seeded queue, for the clinician who can see that patient.** Rowan Testcase critical (severe DEMO-ALPHA allergy; latest blood pressure 148/92 is only a warning). Elliot Samplewood critical (SpO₂ 91; heart rate 108 is a warning). Jordan Mockridge warning (moderate DEMO-GAMMA allergy; vitals stable; one HbA1c, 5.6%). Morgan Fixture and Casey Placeholder stable. The e2e queue test checks the dots against `queueStatus`.
- **HbA1c.** Rowan has six results, 7.8% down to 6.8%. The 7.1% and 6.9% points are eAG 157 and 151 mg/dL. Jordan has 5.6% (eAG 114). The others have none, and the chart says so.
- **Renew.** The seed signs Ploxidrin for Rowan and Zentoril for Elliot through `sign_prescription`. The test reset keeps those.
- **Notes.** None are seeded. A clinician's first save creates today's note.
- **Checked in the browser on `/dev/chart`:** warning and critical tiles with their words, the six chart points and the hidden table, Privacy masking the values while Warning stayed visible, "Unsaved changes" on a diagnosis edit (cancelled, not saved), a note going from "Unsaved changes" to "Saved" only after the specimen save returned, an empty HbA1c chart, and the Renew link. The dev overlay's hydration warning was `data-cursor-ref` injected by the browser tool, not a mismatch in the app.
- **Unverified, not passed:** a real screen reader on the chart table and the point tooltips; colour-vision review of the accent chart line; the vitals band at a real hosted chart wider than the specimen; Windows forced-colours mode.

## Phase 9 follow-up note: abnormal-vitals banner and diagnosis row tests (24 Oct 2026)

The chart alert slot now shows a banner when the latest vitals reading has a warning or critical vital (red with the emphasis border when critical, orange hairline otherwise), listing each abnormal vital with its DEMO-V rule. Critical banners come before warning ones. The diagnosis row actions gained a component test (pending, success, conflict, permission and validation errors, Unsaved changes, focus return). Details in [theme.md](theme.md#phase-9-vitals-hba1c-diagnoses-encounter-notes).

| Check | Result |
| --- | --- |
| `pnpm typecheck`, `pnpm lint` | clean |
| `pnpm test:unit` | 43 files, 398 passed |
| `pnpm test:db` (kestrel-test) | 6 files, 62 passed |
| `pnpm test:int` (kestrel-test) | 4 files, 24 passed |
| `pnpm test:browser` (all specs) | 301 passed. The HbA1c keyboard test now starts tabbing from "Review vitals", the new last control before the chart on the blocking specimen. |
| `pnpm build`, then `pnpm check:bundle` | build passed; client bundle clean (38 files scanned) |
| `pnpm test:e2e` (kestrel-test) | 26 passed, including Elliot critical, Rowan warning and a stable patient with no banner |

Kestrel-Dev was not written to. No migrations, seeds or resets were run; prescriptions and patient medications were not touched.

- **Checked in review screenshots:** the advisory specimen at 1440px and 390px (critical vitals banner first, advisory draft banner second, no horizontal overflow).
- **Unverified, not passed:** a real screen reader reading the banner; Windows forced-colours mode; the banner with hosted data at widths other than the e2e default.

## Critical-dot pulse

The task asked to assert that the critical-dot pulse stops. **No such animation exists:** `StatusDot` (critical) is static in the code, the plan and the design references. The motion spec asserts that it has no animation. If a pulse is wanted, it needs a design decision first.

## Unverified, not passed

- **Screen-reader testing** (NVDA, JAWS, VoiceOver, TalkBack): unverified, not passed. Announcement checks above inspect roles and live regions in the DOM, not real speech output.
- **Browsers other than Chromium** (Firefox, Safari, mobile browsers), and real phones and tablets: unverified, not passed.
- **Browser zoom to 200% and 400%, text-spacing overrides, Windows forced-colours (high contrast) mode:** unverified, not passed.
- **axe on the signed-in app with hosted data** (as opposed to the specimens): unverified, not passed. e2e covers behaviour, not axe.
- **Skeleton geometry and layout shift with hosted data:** unverified, not passed (specimens only).
- **Touch target sizes** beyond what axe checks: unverified, not passed.
