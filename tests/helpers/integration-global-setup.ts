import { loadTestEnv } from "../../scripts/test-env.ts";
import { resetPrescriptionData } from "./reset";

export default async function setup(): Promise<void> {
  loadTestEnv();
  await resetPrescriptionData();
}
