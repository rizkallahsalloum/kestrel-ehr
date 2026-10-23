import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { KESTREL_DEV_PROJECT_REF } from "./project-refs";

// A fake .env.test naming Kestrel-Dev. Keys are dummies and the database host is unreachable
// (127.0.0.1:1), so even a regressed guard could not write anywhere.
const DEV = KESTREL_DEV_PROJECT_REF;
const FAKE_DEV_ENV = [
  `NEXT_PUBLIC_SUPABASE_URL=https://${DEV}.supabase.co`,
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_dummy",
  "SUPABASE_SECRET_KEY=sb_secret_dummy",
  `SUPABASE_DB_URL=postgresql://postgres.${DEV}:dummy@127.0.0.1:1/postgres`,
  `KESTREL_TEST_PROJECT_REF=${DEV}`,
  "KESTREL_TEST_USER_PASSWORD=q7Zr2xN9vLp4Kt8Wb3Hs",
].join("\n");

const root = resolve(".");
let cwd: string;

beforeAll(() => {
  cwd = mkdtempSync(join(tmpdir(), "kestrel-refuse-dev-"));
  writeFileSync(join(cwd, ".env.test"), FAKE_DEV_ENV);
  writeFileSync(join(cwd, ".env.other"), FAKE_DEV_ENV);
});

afterAll(() => {
  rmSync(cwd, { recursive: true, force: true });
});

function run(args: string[]) {
  return spawnSync(process.execPath, args, { cwd, encoding: "utf8", timeout: 30_000 });
}

describe("Test scripts refuse Kestrel-Dev", () => {
  it.each([
    ["db:seed:test", ["scripts/seed.ts"]],
    ["db:seed:test --env", ["scripts/seed.ts", "--env", ".env.other"]],
    ["db:push:test", ["scripts/db.ts", "push"]],
    ["db:push:test:dry", ["scripts/db.ts", "push", "--dry-run"]],
    ["db:reset:test", ["scripts/db.ts", "reset"]],
    ["db:reset:test --env", ["scripts/db.ts", "reset", "--env", ".env.other"]],
    ["db:types", ["scripts/db.ts", "types"]],
    ["test:db / test:int / test:e2e pre-check", ["scripts/assert-test-env.ts"]],
  ])("%s", (_name, [script, ...args]) => {
    const result = run([join(root, script!), ...args]);
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/Refusing to run: .*Kestrel-Dev/);
  });

  it("the Playwright config (e2e entry) throws before starting a server", () => {
    const config = pathToFileURL(join(root, "playwright.config.ts")).href;
    const result = run(["--input-type=module", "-e", `await import(${JSON.stringify(config)})`]);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/Kestrel-Dev/);
  });
});
