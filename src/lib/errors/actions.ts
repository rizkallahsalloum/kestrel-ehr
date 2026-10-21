"use server";

import { clientReportLogLine, clientReportSchema } from "./client-report";

/**
 * Records an error thrown in the browser in the server log under the reference the user sees.
 * Callable without a session (the login page has error boundaries too); it only writes one
 * JSON log line marked `client-reported`, never to the database.
 */
export async function reportClientError(input: unknown): Promise<boolean> {
  const parsed = clientReportSchema.safeParse(input);
  if (!parsed.success) return false;
  console.error(clientReportLogLine(parsed.data));
  return true;
}
