import { afterEach, describe, expect, it, vi } from "vitest";
import { reportClientError } from "./actions";
import {
  buildClientReport,
  CLIENT_REPORT_LIMITS,
  clientReportLogLine,
  routePattern,
  stackWithoutMessage,
  stripControl,
} from "./client-report";
import { digestOf, newReference, REFERENCE_LENGTH, referenceFromDigest } from "./reference";

const PATIENT_TEXT = "Testcase, Rowan SYN-000101";
const REF = "AB12CD34EF";
const valid = { reference: REF, name: "TypeError", stack: "TypeError\n    at f (app.js:1:1)", route: "/patients/[id]" };

describe("error references", () => {
  it("shortens a digest to the shown reference", () => {
    expect(referenceFromDigest("2875123493123")).toBe("2875123493");
    expect(referenceFromDigest("123")).toBe("123");
  });

  it("creates fresh uppercase hex references", () => {
    const a = newReference();
    expect(a).toMatch(new RegExp(`^[0-9A-F]{${REFERENCE_LENGTH}}$`));
    expect(newReference()).not.toBe(a);
  });

  it("reads only non-empty string digests", () => {
    expect(digestOf(Object.assign(new Error("x"), { digest: "42" }))).toBe("42");
    expect(digestOf(Object.assign(new Error("x"), { digest: "" }))).toBeUndefined();
    expect(digestOf(Object.assign(new Error("x"), { digest: 42 }))).toBeUndefined();
    expect(digestOf(new Error("x"))).toBeUndefined();
    expect(digestOf("boom")).toBeUndefined();
    expect(digestOf(null)).toBeUndefined();
  });
});

describe("building a browser error report", () => {
  it("never includes the error message, in a field or in the stack", () => {
    const error = new TypeError(`Cannot read ${PATIENT_TEXT}\nsecond line`);
    const report = buildClientReport(error, "/patients", REF);

    expect(Object.keys(report).sort()).toEqual(["name", "reference", "route", "stack"]);
    expect(JSON.stringify(report)).not.toContain("Testcase");
    expect(JSON.stringify(report)).not.toContain("second line");
    expect(report.name).toBe("TypeError");
    expect(report.stack).toMatch(/^TypeError\n\s+at /);
  });

  it("keeps a stack that does not start with the message (other engines)", () => {
    const error = new Error(PATIENT_TEXT);
    error.stack = "f@app.js:1:1";
    expect(stackWithoutMessage(error)).toBe("f@app.js:1:1");
  });

  it("truncates the name and stack to the fixed limits", () => {
    const error = new Error("x");
    error.name = "N".repeat(500);
    error.stack = `${error.name}: x\n${"a".repeat(10_000)}`;
    const report = buildClientReport(error, "/", REF);
    expect(report.name).toHaveLength(CLIENT_REPORT_LIMITS.name);
    expect(report.stack).toHaveLength(CLIENT_REPORT_LIMITS.stack);
  });

  it("reports non-Error throws by kind only", () => {
    expect(buildClientReport(PATIENT_TEXT, "/", REF)).toEqual({ reference: REF, name: "NonError", route: "/" });
  });

  it("turns a pathname into a route pattern without query, fragment or record ids", () => {
    expect(routePattern("/patients/00000000-0000-4000-8000-000000000101/prescriptions/new?q=Testcase#x")).toBe(
      "/patients/[id]/prescriptions/new",
    );
    expect(routePattern("/patients/k7m2p9q4rx/prescriptions/new")).toBe("/patients/[ref]/prescriptions/new");
    expect(routePattern("/patients/k7m2p9q4rx/prescriptions/b3c4d5e6f7")).toBe("/patients/[ref]/prescriptions/[ref]");
    expect(routePattern("/patients/Rowan%20Testcase")).toBe("/patients/[ref]");
    expect(routePattern("/patients")).toBe("/patients");
    expect(routePattern("/")).toBe("/");
    expect(routePattern(`/${"a".repeat(1000)}`)).toHaveLength(CLIENT_REPORT_LIMITS.route);
  });
});

describe("log line", () => {
  it("strips newlines, control characters and line separators", () => {
    expect(stripControl("a\r\nb\tc\u0000d\u001be\u007ff\u0085g\u2028h\u2029i")).toBe("a b c d e f g h i");
  });

  it("is one line of JSON marked client-reported, with every field scrubbed", () => {
    const line = clientReportLogLine({
      reference: REF,
      name: "Type\nError",
      route: "/x\u0000",
      stack: 'TypeError\n[kestrel] server error {"forged":true}\r\n    at f',
    });
    expect(line).not.toMatch(/[\u0000-\u001F]/);
    const parsed = JSON.parse(line);
    expect(parsed).toEqual({
      source: "client-reported",
      reference: REF,
      name: "Type Error",
      route: "/x",
      stack: 'TypeError [kestrel] server error {"forged":true}     at f',
    });
  });
});

describe("reportClientError", () => {
  afterEach(() => vi.restoreAllMocks());

  function captureLog() {
    return vi.spyOn(console, "error").mockImplementation(() => {});
  }

  it("logs one JSON line marked client-reported", async () => {
    const log = captureLog();
    expect(await reportClientError(valid)).toBe(true);
    expect(log).toHaveBeenCalledOnce();
    const [line] = log.mock.calls[0]!;
    expect(typeof line).toBe("string");
    expect(JSON.parse(line as string)).toMatchObject({ source: "client-reported", reference: REF, route: "/patients/[id]" });
  });

  it("scrubs control characters a crafted request sends", async () => {
    const log = captureLog();
    await reportClientError({ ...valid, name: "E\n[kestrel] server error", stack: "a\r\nb\u2028c" });
    const line = log.mock.calls[0]![0] as string;
    expect(line).not.toMatch(/[\u0000-\u001F\u2028\u2029]/);
    expect(JSON.parse(line)).toMatchObject({ name: "E [kestrel] server error", stack: "a b c" });
  });

  it.each([
    ["a message field", { ...valid, message: PATIENT_TEXT }],
    ["any other extra field", { ...valid, extra: "x" }],
    ["an oversized name", { ...valid, name: "N".repeat(CLIENT_REPORT_LIMITS.name + 1) }],
    ["an oversized stack", { ...valid, stack: "s".repeat(CLIENT_REPORT_LIMITS.stack + 1) }],
    ["an oversized route", { ...valid, route: `/${"r".repeat(CLIENT_REPORT_LIMITS.route)}` }],
    ["a route with a query string (patient search text)", { ...valid, route: "/patients?q=Testcase" }],
    ["a route with a fragment", { ...valid, route: "/patients#x" }],
    ["a relative route", { ...valid, route: "patients" }],
    ["a malformed reference", { ...valid, reference: "ab12cd34ef" }],
    ["a missing reference", { name: "E", route: "/" }],
    ["an empty name", { ...valid, name: "" }],
    ["a non-object", "boom"],
  ])("rejects %s without logging", async (_label, input) => {
    const log = captureLog();
    expect(await reportClientError(input)).toBe(false);
    expect(log).not.toHaveBeenCalled();
  });
});
