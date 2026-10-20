// Scans the built client bundle for privileged key names or values.
// Run after `pnpm build`.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseEnv } from "node:util";

const staticDir = resolve(".next/static");
if (!existsSync(staticDir)) {
  console.error("No .next/static directory. Run `pnpm build` first.");
  process.exit(1);
}

const needles = ["SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY", "sb_secret_", "SUPABASE_DB_URL"];
for (const file of [".env.test", ".env.local"]) {
  if (!existsSync(file)) continue;
  const values = parseEnv(readFileSync(file, "utf8"));
  for (const key of ["SUPABASE_SECRET_KEY", "SUPABASE_DB_URL", "KESTREL_TEST_USER_PASSWORD", "SUPABASE_ACCESS_TOKEN"]) {
    if (values[key] && values[key].length >= 8) needles.push(values[key]);
  }
}

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) yield* walk(path);
    else yield path;
  }
}

let findings = 0;
let scanned = 0;
for (const file of walk(staticDir)) {
  if (!/\.(js|css|html|json|txt|map)$/.test(file)) continue;
  scanned++;
  const content = readFileSync(file, "utf8");
  needles.forEach((needle, index) => {
    if (content.includes(needle)) {
      findings++;
      // Report the needle index rather than the value so secrets are never printed.
      console.error(`Found forbidden needle #${index} in ${file}`);
    }
  });
}

if (findings > 0) {
  console.error(`${findings} forbidden value(s) found in the client bundle.`);
  process.exit(1);
}
console.log(`Client bundle clean (${scanned} files scanned, ${needles.length} needles).`);
