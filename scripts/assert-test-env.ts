import { loadTestEnv, TestEnvError } from "./test-env.ts";

try {
  const env = loadTestEnv();
  console.log(`Test environment OK (project ref ${env.projectRef}).`);
} catch (error) {
  if (error instanceof TestEnvError) {
    console.error(`Refusing to run: ${error.message}`);
    process.exit(1);
  }
  throw error;
}
