# Kestrel EHR

A clinician-facing EHR **learning and portfolio prototype**.

> **Synthetic data only. Not for clinical use.**
> Kestrel is not a medical device, does not transmit prescriptions anywhere, and its "safety rules" are fictional demo rules about fictional drug classes (`DEMO-*`). It contains no real drug-interaction or allergy guidance. Nothing here is claimed to be secure, compliant (HIPAA, GDPR, or similar), or clinically safe. The tests listed below show specific behaviours; they are not a security certification.

## What the MVP does

Login, patient list, chart, prescription draft, safety check, sign. Specifically:

1. Clinicians sign in (Supabase Auth, email and password; public sign-up disabled).
2. They see only patients assigned to their care team.
3. The chart shows active allergies, current medications and prescriptions. Each chart view is written to the audit log first; if that write fails, the chart is not shown.
4. A clinician drafts a prescription from a fictional catalog. Drafts are validated with shared Zod schemas, protected against double submits (idempotency key), and versioned for optimistic concurrency.
5. The safety check evaluates the fictional rules against the patient's active allergies and medications:
   - **Blocking** alerts (demo allergy class match) are a hard stop. The only ways forward are changing the medication or cancelling the draft.
   - **Advisory** alerts (demo class pairs) must be acknowledged for the current draft version. Editing the draft invalidates earlier acknowledgements.
6. The prescriber reviews and signs (simulated, with an attestation checkbox). Signing re-runs the rules in the same transaction, marks the prescription immutable, adds it to the patient's medication list, and writes audit rows. If any part fails, the whole transaction rolls back.
7. Admins have no clinical access. They can read the audit log at `/admin/audit`.

Two roles exist: `clinician` and `admin`. Access is granted by care-team membership (one team per patient).

### Shell

The top bar has the patient search, **Today's queue** (clinicians: up to six care-team patients as chips, most urgent first, with a red, orange or green status dot and its text label, plus "View all"; on the search row when the chips fit (six chips from 2390px), otherwise on its own row under it, wrapping onto more lines as needed; a severe allergy or blocking alert makes a patient critical, a moderate allergy, advisory alert or unchecked draft a warning), and on the right a sync line ("Synced with Kestrel Health Network", fictional wording; nothing is transmitted; it shows "Offline" when the browser is offline), the **Privacy** button ("Privacy on" when masking), the user's name and "Clinician · Cedar Park" (fictional clinic), and an **account menu** opened from the avatar (Privacy auto-hide delay and Sign out). The rail has Chart, Schedule, E-Rx, Labs and Billing; Schedule, Labs and Billing are placeholder pages ("Not part of this prototype").

### Privacy mode

A **Privacy** button in the top bar (or Ctrl+. / ⌘+.) masks patient values in place, like a password field: names, dates of birth, MRNs, medications, quantities, prescription details and draft form fields show as `••••••` while the rest of the page stays usable. Each masked value is a button; pressing it reveals that one field for 10 seconds (`PRIVACY_FIELD_REVEAL_MS`). Safety alerts, including severity and allergen or drug names, stay visible. Privacy mode also turns on by itself after a period without pointer, keyboard, touch or scroll activity (1 minute by default, `PRIVACY_IDLE_MS`; 30 seconds or 2 minutes can be chosen in the account menu for the tab's session), which also re-masks revealed fields; open dialogs and unsaved drafts are kept. Both values are in `src/features/privacy/config.ts`. The state lasts for the tab's session across navigation (`sessionStorage`), is turned off on the sign-in page and is cleared on sign-out.

**This is client-side shoulder-surfing protection, nothing more.** The data is already in the page and in the React Server Component payload; anyone with access to the browser's developer tools can read it. Privacy mode is not the session timeout and changes nothing about authentication. Details, and the server-rendered alternative that was not built: [docs/theme.md](docs/theme.md#privacy-mode-phase-8-in-place-masking-since-phase-8b).

## Architecture in brief

- **Next.js 16 App Router** (TypeScript strict, React Server Components by default, Tailwind v4). `src/proxy.ts` refreshes the session and redirects anonymous visitors, but it is only a convenience. Every page query and Server Action re-checks the user itself.
- **Supabase Postgres + Auth** via `@supabase/ssr` and `supabase-js`. The app uses only the publishable key and the signed-in user's session, and refuses to start if a secret or service-role key is present in its environment.
- **Authorization lives in the database.** Every table has explicit RLS policies per operation using `(select auth.uid())`. Prescription status changes happen only inside `SECURITY DEFINER` functions (`evaluate_prescription_safety`, `acknowledge_prescription_alert`, `sign_prescription`, `cancel_prescription`) that lock the row and re-check the caller. Column-level grants stop clients from writing `status`, `version`, `patient_id` or `prescriber_id`.
- **Server Actions** follow one pipeline: authenticate, authorize the role, validate with Zod, call the database with the user's client, map database errors (custom SQLSTATEs `KE001`-`KE007`) to a typed `ActionResult` without leaking raw messages.
- **Audit log** (`private.audit_logs`) is append-only. It is not exposed through the API, triggers reject `UPDATE`/`DELETE`/`TRUNCATE`, and rows are written by triggers in the same transaction as the change they describe. Metadata holds identifiers and field names only, never clinical content.

Layout:

```
src/app/            routes: (auth)/login, (app)/patients/..., (app)/admin/audit
src/features/       auth, patients, chart, prescriptions, audit, privacy (queries, actions, schemas, components)
src/lib/            env validation, Supabase clients, auth guards, ActionResult
supabase/migrations 0001-0010, applied in order
supabase/seed/      synthetic seed data (fixed UUIDs, see scripts/fixtures.ts)
scripts/            env guard, migrations, seed, token build, bundle secret check
tests/db            SQL-level RLS, constraint and workflow tests (pg, rolled-back transactions)
tests/integration   supabase-js and Server Action tests with real test users
tests/e2e           Playwright
```

## Setup

You need Node 22+, pnpm, and two hosted Supabase projects you create yourself: `kestrel-dev` (for `pnpm dev`) and `kestrel-test` (for tests only). Docker is not required.

1. `pnpm install`
2. In **both** Supabase dashboards, disable public sign-ups (Authentication > Sign In / Providers).
3. Copy `.env.example` to `.env.test` and fill it in for `kestrel-test`. Copy only the two `NEXT_PUBLIC_*` values for `kestrel-dev` into `.env.local`. Never commit these files or paste keys into chats or issues.
4. Apply migrations and seed the test project:
   ```
   pnpm db:push:test:dry   # review what will be applied
   pnpm db:push:test
   pnpm db:seed:test
   ```
   To seed the dev project, run `node scripts/seed.ts --env <file>` with a separate, git-ignored env file that points at `kestrel-dev`.
5. Regenerate database types from the real schema (`SUPABASE_ACCESS_TOKEN` must be set):
   ```
   pnpm db:types
   ```
6. `pnpm dev`, then sign in as a seeded synthetic user, for example `clinician.a@kestrel.example` with the password you set in `KESTREL_TEST_USER_PASSWORD`.

Every script that touches Supabase refuses to run unless the URL and database URL in `.env.test` both point at `KESTREL_TEST_PROJECT_REF`.

### Differences between hosted projects

Supabase does not create every project with the same defaults. Two differences matter here:

- **`service_role` holds no privileges on Kestrel objects.** Before migration 0010, kestrel-dev granted `service_role` full table access (including `TRUNCATE`) and `EXECUTE` on the public RPCs through Supabase's default privileges, while kestrel-test granted only part of that. Migration 0010 revokes everything on tables, sequences and functions in `public` and `private` from `service_role`, and revokes the default privileges that the migration role (`postgres`) would give it on future objects. Nothing needs them: the app uses the publishable key, the seed uses the secret key only for the Auth admin API, and scripts and tests load data as `postgres`. If a script ever needs the secret key against a table, grant that one privilege in a new migration instead of restoring the defaults. `tests/db` checks that `service_role` holds nothing.
- **`public.rls_auto_enable()` exists only on kestrel-test.** Supabase created it with the project, together with the event trigger `ensure_rls`, which enables RLS on every new table. It is not in the migrations, so kestrel-dev does not have it. It is `SECURITY DEFINER` with `search_path = pg_catalog` and is executable by `PUBLIC`, unlike Kestrel's own functions. It returns `event_trigger`, though, and Postgres rejects direct calls to event trigger functions, so the grant cannot be used through the API. It is left as Supabase created it. Every Kestrel table enables RLS in its own migration, so the trigger changes nothing for them.

## Commands

| Command | Purpose |
| --- | --- |
| `pnpm typecheck` / `pnpm lint` | Static checks |
| `pnpm test:unit` | Schemas, transitions, error mapping, env guard, token build, action gating (no network) |
| `pnpm test:db` | SQL-level RLS, grants, constraints, signing rules, audit behaviour against `kestrel-test` |
| `pnpm test:int` | supabase-js and Server Actions with real test-user JWTs |
| `pnpm test:e2e` | Playwright happy path, blocked path, cancel flow, access control |
| `pnpm test:browser` | Playwright on the development-only specimens (no Supabase): dialog accessibility, contrast, wrapped headings, date field, column collapse at every breakpoint edge, audit table, loading skeleton geometry and layout shift, error pages, axe-core scans, focus rings, combobox and tracker keyboard use, error announcements, reduced motion, Privacy mode, top bar (account menu, Today's queue, sync status, rail, cursor) |
| `pnpm build && pnpm check:bundle` | Checks that no secret names or values from env files appear in the client bundle |
| `pnpm db:reset:test` | Re-applies the schema on `kestrel-test`; run `pnpm db:seed:test` afterwards |

## Verification status

Be precise about what has and has not been shown:

- Unit and component tests (253), typecheck, lint, browser specimens (229, including axe-core scans, focus rings, keyboard use, reduced motion and the Phase 8c top bar), production build and the client-bundle secret check pass locally (22 Oct 2026, Phase 8c). Details, axe findings and what remains unverified (including any screen-reader test): [docs/qa-phase7.md](docs/qa-phase7.md).
- Privacy mode (Phase 8b, in-place masking) is checked in Chromium only: masked values absent from page text and the accessibility tree, reveal by click, Enter and Space, re-mask after 10 seconds and idle auto-hide with a fake clock, focus kept on toggle, the shortcut in a text field and a dialog, alerts readable with identifiers masked, persistence across navigation, reloads and skeletons, dialogs and unsaved drafts kept, no layout shift at 1440 / 1024 / 390px, reduced motion, and axe with values shown, masked and revealed (no findings). Not tested with a screen reader, in other browsers, on macOS (⌘+.) or with an input method editor.
- Loading skeletons are checked against the specimens only: column boxes match at every collapse step, and layout shift stays below 0.05 when content streams in. Not measured on hosted data.
- Against hosted `kestrel-test` with migrations 0001-0010 applied (21 Oct 2026): `pnpm test:db` 46 passed, `pnpm test:int` 18 passed, `pnpm test:e2e` 16 passed (`auth`, `shell`, `prescribing`, `dev-routes`; the first run had 3 hosted-latency timeouts, the re-run passed). After Phase 8 and its follow-up (21 Oct 2026), `pnpm test:e2e` 17 passed on the first run each time, including the Privacy mode sign-out/sign-in case, again after Phase 8b (22 Oct 2026, 17 passed), and after Phase 8c (22 Oct 2026, 19 passed, including Today's queue and the placeholder pages); `test:db` and `test:int` were not re-run (no database or Server Action changes).
- In the production build every `/dev/*` URL returns 404 from the proxy, signed in or out, and the `?skeleton` and `?delay` specimen modes have no effect (`tests/e2e/dev-routes.spec.ts`).
- Chart end-to-end coverage is `tests/e2e/chart-records.spec.ts` (Phase 9: vitals, HbA1c, diagnoses, notes, Renew) plus `tests/integration/chart.test.ts`, `tests/integration/chart-records.test.ts` and the browser specimens.
- Migrations 0001-0010 are applied to both hosted projects. Read-only comparison of table, column, function and default grants, RLS flags and policies (20 Oct 2026): identical except `rls_auto_enable`, which exists only on `kestrel-test` (see above). `service_role` holds no privileges on Kestrel objects in either project. Migrations 0011-0015 (opaque references, diagnoses, vitals, HbA1c, encounter notes) are applied to `kestrel-test` only. `kestrel-dev` was not updated.

## Known limitations

- **Read auditing is incomplete.** Chart views through the app are logged before any data is returned, but a user calling the Supabase API directly with their own session can read rows RLS allows without a `patient_chart.viewed` entry. Closing this means serving reads only through logging definer functions.
- **RLS is enabled but not `FORCE`d.** Definer functions run as the table owner and rely on their own explicit checks. The table owner (`postgres`) can bypass RLS and alter the audit triggers; tamper-evidence (hash chaining, external log shipping) is out of scope.
- **Browser error reporting is anonymous and not rate-limited.** The error pages send the error name, a truncated stack (without the message), the route pattern and the on-screen reference to a Server Action that needs no session, so the login page can report too. Input is validated with fixed maximum lengths and scrubbed of control characters, and each report is logged as one JSON line marked `"source": "client-reported"`, but anyone can call the endpoint to fill the log. Production would need a session requirement and rate limiting at the edge.
- **`src/types/database.ts` is hand-written** to match the migrations. Replace it with `pnpm db:types` output once a project exists.
- **A few theme values are not from Figma.** Warning colors that fail contrast as exported, and values with no semantic token, are overridden in one place. See [docs/theme.md](docs/theme.md).
- `supabase db reset --db-url` without Docker has not been verified (see `scripts/db.ts`).
- No MFA or re-authentication before signing, no voiding of signed prescriptions, and no admin UI for teams.
- Renewing a signed prescription can leave the earlier medication active as well. See [docs/theme.md](docs/theme.md#known-issues).

## Design system

Full rules, overrides and contrast notes: [docs/theme.md](docs/theme.md).

- **Token source.** `design-reference/design-tokens.tokens.json` (the Figma export) is the source of truth. `pnpm tokens:build` writes it to `src/styles/tokens.css`, and `src/app/globals.css` maps those variables to Tailwind names. Components use those names only: no raw hex, rem or pixel values. A layout dimension without a token gets a named one in `globals.css`.
- **Breakpoints.** Figma-derived, not Tailwind's defaults: `md` starts at 761px, so every layout is one column at 760px and below. Multi-column layouts collapse one step at a time (3 → 2 → 1 for prescribing, 2 → 1 for the chart) at the page breakpoints listed in the theme doc.
- **Severity colours.** Red for severe and critical states (blocking alerts, severe allergies, critical queue dots, offline), orange for moderate and warning states, green for stable. Form errors stay orange. Red also marks the "Cancel draft" confirm. Every alert uses the triangle icon; blocking is told apart by the 2px outline, the label and ordering, never by colour alone. Details: [docs/theme.md](docs/theme.md#severity-colours-phase-8c-replaces-the-phase-5-red-and-orange-rule).
- **Components.** Shared primitives live in `src/components/ui/`, the shell in `src/components/shell/`, and feature components in `src/features/<feature>/components/`. Development-only specimens at `/dev/theme`, `/dev/components`, `/dev/shell`, `/dev/chart`, `/dev/prescribing`, `/dev/audit`, `/dev/error` and `/dev/privacy` (404 outside `pnpm dev`) show every state.
- **Motion and focus.** Animations stop under `prefers-reduced-motion`. Every focusable control shows a ring of at least 3:1 (white on the dark rail).

### Re-exporting design tokens

1. Export the complete token file from the design tool and save it as `design-reference/design-tokens.tokens.json`.
2. Run `pnpm tokens:build`. Only `semantic.*` tokens are emitted, as `--k-*` CSS variables in `src/styles/tokens.css`. Unresolved references are listed in a comment at the top of that file.
3. Map any new variables into the Tailwind theme in `src/app/globals.css` (`@theme inline static`), and update [docs/theme.md](docs/theme.md) if an override can be removed.

## Stretch feature (design only, not implemented): encounter transcription

A possible future feature that turns a scripted, synthetic encounter recording into a **draft** note. It is deliberately outside the MVP.

**Data flow**

1. A clinician on the patient's care team starts a transcription job from the chart. A `transcription_jobs` row is created (`patient_id`, `requested_by`, `status = 'queued'`) under the same care-team RLS as other clinical tables.
2. The browser uploads synthetic or scripted audio to a private Storage bucket, at a path keyed by the job id, with a short-lived signed upload URL. No other user can read the object.
3. A background worker (Supabase Edge Function or queue consumer) claims the job (`status = 'processing'`), sends the audio to the speech-to-text and summarisation provider, and stores the result as `transcription_drafts` (`job_id`, `generated_text`, `model`, `created_at`).
4. **The raw audio is deleted as soon as processing finishes or fails.** A scheduled sweep deletes any object older than a short time-to-live in case the worker crashes. Only the job row records that audio existed.
5. The clinician reviews and edits the generated text in a clearly labelled "AI-generated draft — unverified" editor, then explicitly saves it as a clinical note. Saving copies the edited text into the notes table with `verified_by` and `verified_at`, and links back to the draft for provenance.

**Asynchronous processing and errors**

- Job states: `queued`, `processing`, `ready_for_review`, `failed`, `discarded`. Transitions happen only in definer functions, as for prescriptions.
- The UI polls the job status (or uses Realtime on the job row). Nothing blocks a request while audio is processed.
- Provider timeouts and errors set `failed` with a non-clinical error code, delete the audio, and allow one manual retry with a fresh upload. Retries are idempotent per job id.
- Partial or low-confidence output is still only a draft. It is never auto-saved.

**Privacy safeguards**

- Synthetic or scripted audio only. The upload screen states this, and the feature is disabled when the deployment is not flagged as synthetic.
- The provider is called with a server-side key from the worker only, never from the browser, and is configured not to retain or train on inputs where the provider supports that.
- Audit events: `transcription.requested`, `transcription.completed` or `transcription.failed`, `transcription.verified`, `transcription.discarded`. Metadata holds identifiers only, never transcript text.

**Boundary between generated text and clinical documentation**

- Generated text lives only in `transcription_drafts`, which no other clinical view reads.
- A note becomes part of the record only through an explicit clinician action that stores who verified it and when. Generated text that is never verified expires and is deleted.
- The UI always distinguishes AI-generated draft text from verified documentation.
