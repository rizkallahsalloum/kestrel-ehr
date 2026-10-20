import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadTestEnv, TestEnvError } from "./test-env.ts";

const SUPABASE_CLI = resolve("node_modules/supabase/dist/supabase.js");

function run(args: string[], options: { capture?: boolean; env?: Record<string, string> } = {}): string {
  const result = spawnSync(process.execPath, [SUPABASE_CLI, ...args], {
    stdio: options.capture ? ["inherit", "pipe", "inherit"] : "inherit",
    env: { ...process.env, ...options.env },
    encoding: "utf8",
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
  return result.stdout ?? "";
}

// `--env <file>` targets another gitignored tooling file (for example Kestrel-Dev); the default is .env.test.
const envFlag = process.argv.indexOf("--env");
const envFile = envFlag === -1 ? ".env.test" : process.argv[envFlag + 1];

let env;
try {
  env = loadTestEnv(envFile);
} catch (error) {
  if (error instanceof TestEnvError) {
    console.error(`Refusing to run: ${error.message}`);
    process.exit(1);
  }
  throw error;
}

const [command, ...rest] = process.argv.slice(2);

switch (command) {
  case "push":
    run(["db", "push", "--db-url", env.dbUrl, ...(rest.includes("--dry-run") ? ["--dry-run"] : [])]);
    break;
  case "reset":
    run(["db", "reset", "--db-url", env.dbUrl, "--no-seed"]);
    console.log("Schema reset. Run `pnpm db:seed:test` to recreate synthetic users and data.");
    break;
  case "types": {
    if (!env.accessToken) {
      console.error("SUPABASE_ACCESS_TOKEN is required in .env.test to generate types.");
      process.exit(1);
    }
    const output = run(
      ["gen", "types", "--lang", "typescript", "--project-id", env.projectRef, "--schema", "public"],
      { capture: true, env: { SUPABASE_ACCESS_TOKEN: env.accessToken } },
    );
    writeFileSync(resolve("src/types/database.ts"), output);
    console.log("Wrote src/types/database.ts");
    break;
  }
  default:
    console.error("Usage: node scripts/db.ts <push [--dry-run] | reset | types> [--env <file>]");
    process.exit(1);
}
