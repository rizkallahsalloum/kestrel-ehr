import { z } from "zod";
import { REFERENCE_LENGTH } from "./reference";

/** Fixed maximum lengths for each field of a browser error report. */
export const CLIENT_REPORT_LIMITS = { name: 100, stack: 4000, route: 300 } as const;

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
// C0 and C1 control characters plus the Unicode line and paragraph separators.
const CONTROL = /[\u0000-\u001F\u007F-\u009F\u2028\u2029]+/g;

/** Replaces newlines and other control characters with a space, so a field can't forge log lines. */
export function stripControl(value: string): string {
  return value.replace(CONTROL, " ").trim();
}

/** Route pattern of a pathname: query and fragment dropped, record ids replaced by `[id]`. */
export function routePattern(pathname: string): string {
  const path = pathname.split(/[?#]/, 1)[0] || "/";
  return path.replace(UUID, "[id]").slice(0, CLIENT_REPORT_LIMITS.route);
}

/**
 * Stack without the error message. V8 stacks start with `Name: message`; the message can hold
 * patient data, and the reference already links the report to the full server-side error.
 */
export function stackWithoutMessage(error: Error): string | undefined {
  const { stack } = error;
  if (!stack) return undefined;
  const header = String(error);
  const frames = stack.startsWith(header) ? `${error.name}${stack.slice(header.length)}` : stack;
  return frames.slice(0, CLIENT_REPORT_LIMITS.stack);
}

/**
 * Report accepted from the browser. Strict: any other field (such as `message`) is rejected.
 * Oversized fields are rejected rather than truncated, since the client already truncates them.
 */
export const clientReportSchema = z
  .object({
    reference: z.string().regex(new RegExp(`^[0-9A-F]{${REFERENCE_LENGTH}}$`)),
    name: z.string().min(1).max(CLIENT_REPORT_LIMITS.name),
    stack: z.string().max(CLIENT_REPORT_LIMITS.stack).optional(),
    route: z.string().max(CLIENT_REPORT_LIMITS.route).regex(/^\/[^?#]*$/),
  })
  .strict();

export type ClientReport = z.infer<typeof clientReportSchema>;

/** Builds the report sent for an error thrown in the browser. Never includes the message. */
export function buildClientReport(error: unknown, pathname: string, reference: string): ClientReport {
  const name = error instanceof Error ? error.name || "Error" : "NonError";
  const stack = error instanceof Error ? stackWithoutMessage(error) : undefined;
  return {
    reference,
    name: name.slice(0, CLIENT_REPORT_LIMITS.name),
    ...(stack ? { stack } : {}),
    route: routePattern(pathname),
  };
}

/** The log line written for a report: one line of JSON, every field scrubbed of control characters. */
export function clientReportLogLine(report: ClientReport): string {
  return JSON.stringify({
    source: "client-reported",
    reference: report.reference,
    name: stripControl(report.name),
    route: stripControl(report.route),
    stack: report.stack === undefined ? undefined : stripControl(report.stack),
  });
}
