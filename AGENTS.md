<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Kestrel EHR project rules

Kestrel EHR is a learning and portfolio prototype. It uses **synthetic data only**, is not a medical device, and must never be described as secure, compliant (HIPAA, GDPR, and similar), or clinically validated.

## Non-negotiable rules

- **Synthetic data only.** Patients must have `SYN-` MRNs and `is_synthetic = true`. Drug names, drug classes and safety rules are fictional (`DEMO-*`). Never add real drug-interaction or allergy guidance.
- **No privileged keys in the app.** `SUPABASE_SECRET_KEY` (or a service-role key) is used only by Node scripts in `scripts/` and tests in `tests/`. The app runtime throws if it is present (`assertNoPrivilegedKeys`). All app data access uses the signed-in user's session so that RLS applies.
- **Never print or copy secrets** from `.env.local` or `.env.test`.
- **Authorization lives in the database.** RLS policies and `SECURITY DEFINER` functions in `supabase/migrations/` are the final authority. Server Actions re-check authentication and role, validate with Zod, and map database errors, but never replace RLS.
- **Every mutation** follows: authenticate, authorize, validate (shared Zod schema), enforce business rules, run the database call with the user's client, return an `ActionResult`.
- **Status changes** on prescriptions happen only through `sign_prescription` and `cancel_prescription`. Do not grant direct `UPDATE` on `status`, `version`, `patient_id`, or `prescriber_id`.
- **Audit log** (`private.audit_logs`) is append-only. Never add update/delete grants or policies. Metadata must not contain patient content.
- **Security definer functions** must `set search_path = ''`, use fully qualified names, derive the actor from `auth.uid()`, and revoke `EXECUTE` from `public` and `anon`.
- **No caching of clinical data.** `cacheComponents` stays disabled; do not add `use cache` to anything that reads patient data.
- **New migrations** go in `supabase/migrations/` with the next sequential prefix. Never edit a migration that has been pushed to a shared project.

## Commands

```
pnpm dev               # app against .env.local (kestrel-dev)
pnpm typecheck
pnpm lint
pnpm test:unit         # no network
pnpm test:db           # SQL-level RLS/constraint tests against kestrel-test (.env.test)
pnpm test:int          # supabase-js + Server Action tests against kestrel-test
pnpm test:e2e          # Playwright against kestrel-test
pnpm test:browser      # clears .next/dev, then Playwright on /dev specimens via next dev; no Supabase needed
pnpm db:push:test      # apply migrations to kestrel-test
pnpm db:seed:test      # create synthetic users and seed data on kestrel-test
pnpm db:reset:test     # drop and re-apply schema on kestrel-test, then seed again
pnpm db:types          # regenerate src/types/database.ts (needs SUPABASE_ACCESS_TOKEN)
pnpm tokens:build      # regenerate src/styles/tokens.css from design-reference/design-tokens.tokens.json
pnpm check:bundle      # after `pnpm build`: assert no secrets reached the client bundle
```

All scripts that touch Supabase refuse to run unless `.env.test` points at `KESTREL_TEST_PROJECT_REF`.
