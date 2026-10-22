import { orderQueue, type QueuePatient } from "@/features/patients/queue";

// Static synthetic Today's queue for the /dev specimens. Seven patients, so the "View all" chip shows.
export const DEMO_QUEUE: QueuePatient[] = orderQueue([
  { id: "00000000-0000-4000-8000-000000000101", givenName: "Rowan", familyName: "Testcase", status: "critical" },
  { id: "00000000-0000-4000-8000-000000000102", givenName: "Mira", familyName: "Demoson", status: "warning" },
  { id: "00000000-0000-4000-8000-000000000103", givenName: "Ellis", familyName: "Placeholder", status: "stable" },
  { id: "00000000-0000-4000-8000-000000000104", givenName: "Zoë", familyName: "Sampleton", status: "stable" },
  { id: "00000000-0000-4000-8000-000000000105", givenName: "Ada", familyName: "Mockridge", status: "stable" },
  { id: "00000000-0000-4000-8000-000000000106", givenName: "Jun", familyName: "Fixture", status: "warning" },
  { id: "00000000-0000-4000-8000-000000000107", givenName: "Lior", familyName: "Specimen", status: "stable" },
]);

/** `?queue=N` keeps the first N demo patients (0 to 7); `?queue=unavailable` shows the failed-load state. */
export function demoQueue(param: string | string[] | undefined): QueuePatient[] | null {
  if (param === "unavailable") return null;
  const count = typeof param === "string" ? Number.parseInt(param, 10) : Number.NaN;
  return Number.isInteger(count) && count >= 0 ? DEMO_QUEUE.slice(0, count) : DEMO_QUEUE;
}
