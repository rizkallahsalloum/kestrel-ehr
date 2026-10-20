import { resetPrescriptionData } from "../helpers/reset";

export default async function globalSetup(): Promise<void> {
  await resetPrescriptionData();
}
