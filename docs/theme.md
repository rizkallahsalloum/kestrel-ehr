# Kestrel theme

Phase 1 of the frontend plan, approved with the exceptions below. The design system is a learning prototype; nothing here is a claim of accessibility compliance beyond the measured contrast ratios listed.

## Pipeline

1. `design-reference/design-tokens.tokens.json` is the Figma export and the source of truth. Treat it as read-only; replace it with a fresh export.
2. `pnpm tokens:build` (`scripts/build-tokens.mjs`) resolves every `semantic.*` token through the primitives and writes `--k-semantic-*` variables to `src/styles/tokens.css`. Do not edit that file by hand.
3. `src/app/globals.css` maps those variables to Tailwind names in `@theme inline static`. Every mapping has a literal fallback equal to the current Figma value.
4. The `:root` block at the top of `globals.css` holds the `--kf-*` overrides. It is the only place where a value differs from, or is missing in, Figma.

Review everything at `/dev/theme` (development only: `pnpm dev`, then open the route).

## Approved overrides

All overrides live in the `:root` block of `globals.css`. Components use the Tailwind names, never the `--kf-*` variables or raw hex values.

| Tailwind name | Value | Replaces | Reason |
| --- | --- | --- | --- |
| `warning` | #8A5A0E | `warning.text` #9C6A15 | Figma text on Figma fill is 3.83:1 (fails 4.5:1). Override pair is 5.09:1. |
| `warning-subtle` | #F8EDD6 | `warning.subtle` #F4E7CE | Paired with the text above. |
| `warning-line` | #E9D6AC | `border.warning` #F4E7CE | Figma border equals its own fill, so it is invisible. |
| `status-warning` | #9C6A15 (`warning.border-strong`) | `status.warning` #C98A2A | Figma value is 2.89:1 against the surface (fails 3:1 for indicators). |
| `on-inverse-muted` | #9AA39C | none | No semantic token (same value as primitive `gray.600`). |
| `accent-hover` | #1F5058 | none | No semantic token. `primary.hover` is the ink button hover. |
| `radius-panel` | 12px | none | Figma radii jump from 8 to 16; the references use 12 for inner panels and tiles. |

Rail and inverse text (`on-inverse`) follows Figma `text.on-inverse` (pure white), not the HTML's #EDE9DF.

### Intended usage of the warning colors

- `warning` text on `warning-subtle` fill, outlined with `warning-line`: advisory demo alerts, advisory summaries, the synthetic-data banner.
- Form errors are amber, never red. Red is reserved as described in "Red and orange" below.
  - Field stroke and focus glow: `warning-stroke` (`warning.border-strong`, #9C6A15). It is a non-text indicator and only needs 3:1.
  - Error message text and icon: `warning` (#8A5A0E). `warning-stroke` is not used for text, because it falls below 4.5:1 on `page` and on `warning-subtle`, where the acknowledgement form sits inside advisory alerts.
- `status-warning`: status dots and other non-text indicators. Always pair a dot with a text label.

### Red and orange (revised after the Phase 5 review; replaces the Phase 4 rule)

One rule, shared with `.cursor/rules/kestrel.mdc`:

- **Red** (`danger`, hover `danger-ink`) is used only for **resolution actions and destructive confirms**. Today that is only the "Cancel draft" confirm button in the cancel dialog (`Button variant="danger"`). Nothing that *detects* a problem is red. The other red-valued tokens (`danger-subtle`, `danger-line`, `status-critical`, `avatar-red`) stay mapped in `globals.css` but are not used; the red avatar tone was removed before Phase 6.
- **Orange** (`warning`, `warning-subtle`, `warning-line`, `warning-stroke`, `status-warning`) is used for **every detection state**: blocking demo alerts, severe allergies (and critical vitals if they are ever modelled), advisory demo alerts, mild and moderate allergies, and form errors.
- **Blocking versus advisory is never told apart by colour alone.** It's told apart by four cues, all from `src/components/ui/severity.ts`:

  | Cue | Blocking (`critical` tone) | Advisory (`warning` tone) |
  | --- | --- | --- |
  | Border width | `--border-width-emphasis` (2px) in `warning-stroke` (`severityOutline.critical`) | hairline (1px) in `warning-line` (`severityOutline.warning`) |
  | Icon | circle with exclamation (`severityIcons.critical`) | triangle (`severityIcons.warning`) |
  | Label text | "Blocking", "Severe", "N blocking alert(s)", "Severe allergy" | "Advisory", "Moderate", "Mild", "to acknowledge" |
  | Ordering | first | after blocking; acknowledged advisories last |

  Where a 2px border would change an element's size, the emphasis is drawn without it: the `Badge` uses an inset ring, `SeverityTag` trades one pixel of padding, and the review count pill always reserves a 2px border (transparent unless blocking).
- A summary takes the **treatment** of the highest severity it summarizes: the allergies card (outline and icon), the patient hero allergy badge, the E-Rx allergy tile, the medication safety summary, the review count pill and the chart alert banner all use the blocking treatment when anything blocking or severe is present. Row dividers stay hairline in every tone.
- Ordering is enforced in the components, not only by the database queries: `bySeverity` (allergies) and `orderAlerts` (prescription alerts) are unit-tested, and the chart banners were already sorted blocking first.

### Usage rules from the contrast report

- Do not put `ink-muted` on `surface-warm` (4.45:1). Use `ink-secondary` (4.65:1) or `ink-strong` on warm fills.
- `ink-muted` is fine on `surface` (5.24:1) and `page` (4.77:1).
- Field placeholders and suffixes use `ink-placeholder` on `surface`, and `ink-secondary` on the warm read-only or disabled fill (`ink-placeholder` on `surface-warm` is 4.45:1).
- Disabled controls are exempt from contrast minimums but keep their visible label.

### Blocking and advisory pairings (orange family)

`danger-subtle` and `danger-line` are no longer used by any component; they stay defined because they come from the Figma export. Blocking and advisory states share the `warning-subtle` fill. Measured on `/dev/components` and asserted by `pnpm test:browser` (`tests/browser/contrast.spec.ts`):

| Pairing | Ratio | Needs |
| --- | --- | --- |
| `warning` title, label, badge and pill text on `warning-subtle` | 5.09:1 | 4.5:1 |
| `warning` allergy names and tag text on `surface` / `surface-pure` | 5.82:1 / 5.92:1 | 4.5:1 |
| `ink` / `ink-strong` body text on `warning-subtle` | 13.78:1 / 5.66:1 | 4.5:1 |
| `accent` "Go to medication" link on `warning-subtle` | 5.15:1 | 4.5:1 |
| `focus` ring on controls inside an alert | 5.10:1 | 3:1 |
| Blocking 2px outline (`warning-stroke`) on `warning-subtle` / `surface` / `surface-pure` / `page` | 4.03:1 / 4.61:1 / 4.68:1 / 4.19:1 | 3:1 |
| Blocking pill outline (`warning-stroke`) on the `inverse` review header | 3.42:1 | 3:1 |
| Advisory 1px outline (`warning-line`) | 1.41:1 on `surface` | none (decorative) |
| "Cancel draft" confirm: `on-accent` on `danger` / hover `danger-ink` | 6.00:1 / 9.75:1 | 4.5:1 |

The blocking outline is a real non-text indicator and passes 3:1 everywhere it is drawn. The advisory outline and the fill against `surface` are decorative. An advisory alert is identified by its triangle icon, label and text. Do not put `ink-secondary`, `ink-muted` or `ink-placeholder` on `warning-subtle`.

### Additions in Phase 2

- `scrim`: dialog backdrop, built from `inverse` at `opacity.overlay` (50%). It replaces Figma `bg.modal`, which must not be used (see the data issues below).
- `text-button-sm/md/lg`: button font sizes from `button-size.*.font-size` (14, 14, 16).

### Additions in Phase 4

- Allergy tones follow "Red and orange": severe is `critical` (blocking treatment), mild and moderate are `warning`. (A `neutral` `SeverityTag` tone briefly used for mild allergies was removed.) `PanelTitle` has a `warning` icon tone.
- `CardHeader` wraps its actions below the title when the title would be narrower than 240px, so a header button never overlaps the heading on narrow screens.
- Chart text pairings are on `/dev/components` (rows "Chart …") and enforced by `tests/browser/contrast.spec.ts`. The allergy row divider (`warning-line` since the Phase 5 review) is decorative.

### Additions in Phase 5

- E-Rx tones follow "Red and orange": blocking safety cards, the blocking count pill and a severe-allergy tile get the `critical` (blocking) treatment; advisory cards, the "to acknowledge" pill, the unsaved-changes notice and a mild/moderate allergy tile are `warning`; the cancel confirm is the only `danger` (red) element. Acknowledged advisories become a neutral card with an `ok` check and "Acknowledged" badge. Clear states ("No open demo alerts", "All addressed", tracker checks) use `ok`.
- E-Rx text pairings are on `/dev/components` (rows "E-Rx …"). The selected-medication outline (`accent`), the tracker dots and the sentence-style direction controls (`line-field`) are checked as UI (3:1).
- The prescribing pages set `data-layout="wide"`; the shell's `<main>` drops its `max-w-6xl` cap for them (`has-[[data-layout=wide]]:max-w-none`), because the three-column reference layout has no width cap and the form column would otherwise be under 400px.

### Changes from the Phase 5 review

- **Red is no longer used for detection** (see "Red and orange"). Converted from red to the orange blocking treatment: the chart alert banner, the chart allergy panel, the patient hero allergy badge, the E-Rx severe-allergy tile, the E-Rx medication safety summary, the review count pill and the E-Rx blocking alert card. The `critical` tones of `Badge`, `SeverityTag`, `StatusDot` (orange dot with an emphasis outline ring), `Card`, `PanelTitle` and `AlertBanner` changed with them.
- **Draft status badge is `neutral`** (was `warning`), on the chart's prescription list and the E-Rx page heading. Draft and cancelled now share the neutral pill; the written status tells them apart. The synthetic-data banner stays orange.
- **Section tracker uses a container query** on the tracker itself. Below `@tracker-row` (20rem) the steps stack with full labels. From `@tracker-row` they sit in one row with short labels ("Directions" for "Directions and supply"). From `@tracker-full` (28rem) the full labels return. Labels never wrap (`whitespace-nowrap`), and the link's accessible name is always the full label: the short label is `aria-hidden` and the full label is `sr-only` while hidden.
- **Disabled actions show their reason.** When unsaved edits or prerequisites disable "Sign prescription", "Run safety check" or "Acknowledge", the reason is visible next to the button and linked with `aria-describedby`. The sign button references each reason list item by id, because a referenced list's `aria-label` would replace its text in the description.
- **Specimens:** `/dev/chart?view=mixed` and `/dev/prescribing?view=mixed` show blocking and advisory side by side, with inputs deliberately out of order to demonstrate the ordering.

### Raw values: tokens and documented exceptions

Replaced with existing tokens: `scroll-padding-top` → `--spacing-md`; focus `outline-offset` → `--spacing-xxxs`; the `error-ring` / `focus-ring` glow → `--border-width-heavy`; their 0.5px inset → `calc(--border-width-emphasis − --border-width-field)`; the `fade-up` 6px offset → `calc(--spacing × 1.5)`; dev specimen `max-w-[68ch]` → `max-w-prose`.

New named tokens: `--radius-focus` (6px, focus outline corners in all three references), `--text-suffix` (0.85em, Input System `.sfx`), `--animate-fade-up-2` / `-3` / `-context` (dashboard stagger 40 / 80 / 60ms), `grid-cols-key-value` (E-Rx `.kv`), `grid-cols-rx-header` (E-Rx `.hdr`), and the `tracker-row` / `tracker-full` container sizes.

Documented exceptions (left as literals on purpose):

| Value | Where | Why |
| --- | --- | --- |
| `env(safe-area-inset-*, 0px)` | `body` padding | Zero fallback for the CSS environment variable; not a design value. |
| `0.001ms` | `prefers-reduced-motion` reset | Effectively disables motion while still firing animation and transition events; not a design value. |
| `max-w-[14ch]` | `/dev/theme` wrap sample | Development specimen only; forces the heading sample to wrap for `tests/browser/typography.spec.ts`. |
| SVG geometry (24px viewBox, 1.8 stroke) | `src/components/ui/icons.tsx` | Icon drawing coordinates from the references, not layout values. |
| `min(420px, calc(100vw - 2rem))` | `--width-dialog` | Already a named token; the literals live inside its definition. |
| `0`, `1fr`, `max-content`, `auto` | grid templates | Keywords inside named grid tokens. |

### Buttons and inputs are separate type roles (approved)

Buttons use `text-button-*` (14 / 14 / 16px for sm / md / lg). Text inputs, selects and the combobox use `text-control-*` (12 / 14 / 16px). The small sizes intentionally differ; do not align them.

## Line-height pairing (provisional)

Figma defines line heights by role, not per font size. Each size is paired with the closest role:

| Role (Figma) | Line height | Sizes using it |
| --- | --- | --- |
| `caption` | 16px | caption 11, label-sm 12, control-sm 12, code-sm 12 |
| `body` | 20px | label 13, body-sm 13, body 14, control-md 14, code-md 13, code-lg 14, button sm/md 14 |
| `heading-3` | 24px | body-lg 16, heading-sm 16, heading-md 18, data-sm 18, control-lg 16, button-lg 16 |
| `heading-2` | 28px | heading-lg 20 |
| `heading-1` | 32px | heading-xl 24, data-md 24 |
| `display` | 40px | display-md 32, display-lg 40, data-lg 32 |

Rules: text at or below 12px uses `caption`; 13–14px uses `body`; 16–18px uses `heading-3`; 20px uses `heading-2`; 24px uses `heading-1`; 32px and above uses `display`. `display-lg` therefore sets solid (40 on 40); multi-line samples are on `/dev/theme` for review.

`display-lg` 40/40 is accepted provisionally. `pnpm test:browser` checks the wrapped samples at 360, 760 and 1280px. At 40/40, Fraunces glyphs extend 4px past the last line box (IBM Plex Mono at `data-lg` 32/40 extends 1px); the lines do not collide, but do not put `display-lg` in a container with `overflow: hidden`, `truncate` or `line-clamp`, which would clip descenders. The test fails if any other sample overflows or these amounts grow.

## Figma data issues (fix at the source)

| Token | Problem | Handling until fixed |
| --- | --- | --- |
| `bg.modal` | References `black.transparent`, which is `#000000ff` (opaque black). | **Source correction requested.** Intended value: `bg.inverse` (#1C2321) at `opacity.overlay` (50%), used only as the modal dialog backdrop. The app uses `scrim` and must not map `bg.modal` until Figma confirms that value and usage. |
| `error.subtle`, `alert.critical.bg` | Reference `gray.100`, which is pink (#F6E4E1). The primitive is misfiled under gray. | **Source-organization issue only.** The colour is retained provisionally as `danger-subtle`; Figma should move the primitive into the red family without changing the value. |

Resolved: `button-size.sm.font-size` (14px) and `text-size.control.sm` (12px) are both correct; they belong to different roles (see above).

## Component behaviour

- **Dialog focus is native, not strictly trapped (approved).** `Dialog` uses `showModal()`, which makes the rest of the page inert. In Chromium, Tab past the last control moves focus out of the page to the browser toolbar for one keypress; the next Tab returns to the first control in the dialog. Focus never reaches application content behind the dialog, background clicks are blocked, Escape closes it, and focus returns to the trigger (`tests/browser/dialog.spec.ts`). No custom Tab/Shift+Tab wrapping is added. Revisit only if cross-browser or assistive-technology testing shows focus reaching interactive application content behind an open dialog.
- **Rail focus outline is white, not the theme focus colour (resolved, Phase 3).** The theme focus ring (`focus`, #356F51) measures about 2.7:1 on the inverse rail, below the 3:1 minimum for UI. Rail controls use a 2px `on-inverse` outline instead (`railFocus` in `src/components/shell/rail.tsx`). All other surfaces keep the theme focus ring.
- **Rail current-item marker uses `on-inverse`, not the reference teal (approved, Phase 3).** The Figma/HTML reference draws the 2px bar in the teal accent, which measures about 2.7:1 on the inverse rail, below the 3:1 minimum for UI. The bar intentionally deviates and uses `on-inverse`, the same token as the current item's label, so it passes against both the rail and the item's 10% white background (rows "Rail current marker" on `/dev/components`, enforced by `tests/browser/contrast.spec.ts`). The other cues are unchanged: the 10% white background, the white label instead of the dimmed label, and `aria-current="page"`.
- **Focused fields with an error get the standard focus outline (Phase 7).** An invalid field keeps its orange `warning-stroke` border while focused, so the earlier 12% focus glow was the only change on focus, far below 3:1 against the surface. `error-ring-focus` now draws the global 2px `focus` outline outside the field instead of the glow; the error stroke is unchanged. Valid fields keep `focus-ring`. Checked by `tests/browser/keyboard.spec.ts`.
- **Figma-derived breakpoints take precedence (approved, after Phase 4).** The breakpoints below come from the HTML/Figma references and override Tailwind's defaults on purpose; do not reset them to Tailwind's values. `sm` is still Tailwind's default 40rem.
- **Rail breakpoint (resolved, Phase 3).** `md` starts at 761px, matching the reference's `max-width: 760px` query: the rail is 60px icon-only at 760px and below, and 76px with labels above. Every `md:` utility moved with it, so the top bar and patient list switch at the same width as the rail. `lg`, `xl` and `2xl` still start at 820, 1180 and 1280px, while the references use `max-width` at those values, so each is one pixel off at exactly that width; they are left unchanged until a phase needs them.
- **Dashboard workspace breakpoint (approved, Phase 4).** The chart workspace uses its own `workspace` breakpoint (1181px): one column at 1180px and below, as in the reference, and two columns with the sticky side column above. The global `xl` stays at 1180px, so the top bar's "Synthetic data" tag is still visible at exactly 1180px. Use `workspace:` only for the dashboard workspace layout.
- **E-Rx workspace breakpoints (Phase 5).** The prescribing workspace uses `erx` (821px) and `erx-wide` (1281px), matching the reference's `max-width: 820px` and `max-width: 1280px` queries exactly: one column at 820px and below, context (280px) plus form with the review panel spanning below up to 1280px, and three columns (300px / fluid / 380px, sticky review) above. Use them only for that layout. The shell rail stays at every width (D5), unlike the reference, which hides navigation at 820px.
- **E-Rx field grids use container queries (Phase 5).** The form column's width depends on the side columns, not the viewport, so field grids switch on the column's own width: two columns from `@fields-2` (22rem) and four from `@fields-4` (40rem). Both sizes are named tokens in `globals.css`.
- **Date inputs keep the browser's default picker (approved, Phase 5; resolves the duplicate calendar icon).** Date fields have no `leading` calendar icon; the browser's own picker button is the only icon, and keyboard entry works as usual. **Difference from Figma/HTML:** the Input System and E-Rx references draw the start date as a "Today / Tomorrow" select with a leading calendar icon at the left of the field. The app uses a native `type="date"` input instead (the database accepts any date within ±30 days), so the icon is the browser's, at the right, and its look varies by browser. The `/dev/components` specimen still shows the both-icons case as a reference.

### Page-specific breakpoints

Global breakpoints (`md` 761, `lg` 820, `xl` 1180, `2xl` 1280) are listed under "Values that do not come from Figma". These apply to one layout each; use them nowhere else.

| Breakpoint | Starts at | Reference value | Layout | Behaviour |
| --- | --- | --- | --- | --- |
| `workspace` | 1181px | Dashboard `@media (max-width: 1180px)` | Patient chart workspace | One column at 1180px and below; chart plus sticky 340px context column above |
| `erx` | 821px | Revised E-Rx `@media (max-width: 820px)` | Prescribing workspace | One column at 820px and below; 280px context plus form above, review panel spanning below |
| `erx-wide` | 1281px | Revised E-Rx `@media (max-width: 1280px)` | Prescribing workspace | Three columns (300px / fluid / 380px sticky review) above 1280px |

Each starts one pixel above the reference's `max-width` value, so the switch happens at exactly the reference width. The container sizes `fields-2` (22rem) and `fields-4` (40rem) are not breakpoints: they respond to the E-Rx form column's width.

## Known issues

- None open from Phase 5. The duplicate calendar icon is resolved above (native picker only).

## Values that do not come from Figma

- Display font Fraunces (the export only defines Inter and IBM Plex Mono).
- `touch` 44px minimum target and `cta` 52px sign button.
- Breakpoints 761 (`md`), 820, 1180 and 1280px, the dashboard-only `workspace` breakpoint at 1181px, the E-Rx-only `erx` (821px) and `erx-wide` (1281px) breakpoints, the `fields-2` / `fields-4` container sizes, and the `fade-up` entrance motion.
- E-Rx layout tokens: `grid-cols-erx` (280px context + form) and `grid-cols-erx-wide` (300px context + form + 380px review).
- Layout dimensions measured from the HTML references, as named tokens in `globals.css`: `grid-cols-shell` (60px rail) and `grid-cols-shell-wide` (76px rail), `grid-cols-workspace` and `w-context` (340px context column), `w-dialog` (420px, capped to the viewport), `max-w-footer` (760px), `top-below-topbar` (78px sticky offset), `scroll-mt-below-topbar-stacked` (120px: anchor offset at 760px and below, where the top bar wraps onto two rows and measures 112px), `shadow-rail-current`, and the `error-ring` / `error-ring-focus` utilities. Components never use raw pixel values; other sizes snap to the 4px spacing scale, including quarter steps such as `size-4.75` (19px).
