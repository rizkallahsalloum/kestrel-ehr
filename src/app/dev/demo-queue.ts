import { orderQueue, type QueuePatient } from "@/features/patients/queue";

// Static synthetic Today's queue for the /dev specimens. Seven patients, so the "View all" chip shows.
const DEMO_PATIENTS: QueuePatient[] = [
  { id: "00000000-0000-4000-8000-000000000101", givenName: "Rowan", familyName: "Testcase", status: "critical" },
  { id: "00000000-0000-4000-8000-000000000102", givenName: "Mira", familyName: "Demoson", status: "warning" },
  { id: "00000000-0000-4000-8000-000000000103", givenName: "Ellis", familyName: "Placeholder", status: "stable" },
  { id: "00000000-0000-4000-8000-000000000104", givenName: "Zoë", familyName: "Sampleton", status: "stable" },
  { id: "00000000-0000-4000-8000-000000000105", givenName: "Ada", familyName: "Mockridge", status: "stable" },
  { id: "00000000-0000-4000-8000-000000000106", givenName: "Jun", familyName: "Fixture", status: "warning" },
  { id: "00000000-0000-4000-8000-000000000107", givenName: "Lior", familyName: "Specimen", status: "stable" },
];

export const DEMO_QUEUE: QueuePatient[] = orderQueue(DEMO_PATIENTS);

/** The same patients with every status moved to the next patient, so the chip order changes. */
const ROTATED_QUEUE: QueuePatient[] = orderQueue(
  DEMO_PATIENTS.map((patient, i) => ({ ...patient, status: DEMO_PATIENTS[(i + 1) % DEMO_PATIENTS.length]!.status })),
);

/**
 * `?queue=N` keeps the first N demo patients (0 to 7); `?queue=unavailable` shows the failed-load
 * state; `?queueOrder=rotated` reorders the queue by moving every status to the next patient.
 */
export function demoQueue(
  param: string | string[] | undefined,
  order?: string | string[] | undefined,
): QueuePatient[] | null {
  if (param === "unavailable") return null;
  const queue = order === "rotated" ? ROTATED_QUEUE : DEMO_QUEUE;
  const count = typeof param === "string" ? Number.parseInt(param, 10) : Number.NaN;
  return Number.isInteger(count) && count >= 0 ? queue.slice(0, count) : queue;
}
