import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import pg from "pg";
import { IDENTITIES } from "./fixtures.ts";
import { assertSeedablePassword, loadTestEnv, TestEnvError } from "./test-env.ts";

let env;
try {
  env = loadTestEnv(process.argv.includes("--env") ? process.argv[process.argv.indexOf("--env") + 1] : ".env.test");
  assertSeedablePassword(env.testUserPassword);
} catch (error) {
  if (error instanceof TestEnvError) {
    console.error(`Refusing to run: ${error.message}`);
    process.exit(1);
  }
  throw error;
}

const admin = createClient(env.supabaseUrl, env.secretKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

for (const identity of Object.values(IDENTITIES)) {
  const existing = await admin.auth.admin.getUserById(identity.id);
  if (existing.data.user) {
    const { error } = await admin.auth.admin.updateUserById(identity.id, {
      password: env.testUserPassword,
      email_confirm: true,
    });
    if (error) throw new Error(`Could not update ${identity.email}: ${error.message}`);
    console.log(`Updated auth user ${identity.email}`);
  } else {
    const { error } = await admin.auth.admin.createUser({
      id: identity.id,
      email: identity.email,
      password: env.testUserPassword,
      email_confirm: true,
      user_metadata: { full_name: identity.fullName },
    });
    if (error) throw new Error(`Could not create ${identity.email}: ${error.message}`);
    console.log(`Created auth user ${identity.email}`);
  }
}

const client = new pg.Client({ connectionString: env.dbUrl });
await client.connect();
try {
  await client.query("begin");
  await client.query(readFileSync(resolve("supabase/seed/synthetic.sql"), "utf8"));
  await client.query("commit");
  console.log("Synthetic seed data applied.");
} catch (error) {
  await client.query("rollback");
  throw error;
} finally {
  await client.end();
}
