import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const reportClientError = vi.fn<(input: unknown) => Promise<boolean>>();

vi.mock("@/lib/errors/actions", () => ({ reportClientError: (input: unknown) => reportClientError(input) }));
vi.mock("next/navigation", () => ({ usePathname: () => "/patients/11111111-1111-4111-8111-111111111111" }));

const { RouteError } = await import("./route-error");

const SECRET = "relation private.audit_logs: Testcase, Rowan SYN-000101";

function serverError(): Error {
  return Object.assign(new Error(SECRET), { digest: "2875123493123" });
}

const reference = () => screen.getByTestId("error-reference").textContent;
const pageText = () => document.body.textContent ?? "";

describe("RouteError", () => {
  beforeEach(() => {
    reportClientError.mockReset();
    reportClientError.mockResolvedValue(true);
  });

  it("shows a generic alert with the digest reference and never the error text", () => {
    render(<RouteError error={serverError()} retry={() => {}} message="The patient chart could not be loaded." />);

    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("Something went wrong");
    expect(alert.textContent).toContain("The patient chart could not be loaded.");
    expect(alert.contains(screen.getByTestId("error-reference"))).toBe(true);
    expect(reference()).toBe("Reference: 2875123493");
    expect(pageText()).not.toContain(SECRET);
    expect(pageText()).not.toContain("Testcase");
  });

  it("does not report server errors again: the server already logged them under the digest", () => {
    render(<RouteError error={serverError()} retry={() => {}} message="x" />);
    expect(reportClientError).not.toHaveBeenCalled();
  });

  it("reports a browser error without its message and shows the reference it sent", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    render(<RouteError error={new TypeError(SECRET)} retry={() => {}} message="x" />);

    expect(reference()).toBe("Reference: being recorded");
    await waitFor(() => expect(reference()).toMatch(/^Reference: [0-9A-F]{10}$/));
    expect(reportClientError).toHaveBeenCalledOnce();
    const sent = reportClientError.mock.calls[0]![0] as Record<string, unknown>;
    expect(Object.keys(sent).sort()).toEqual(["name", "reference", "route", "stack"]);
    expect(sent).toMatchObject({ name: "TypeError", route: "/patients/[id]" });
    expect(reference()).toBe(`Reference: ${sent.reference}`);
    expect(JSON.stringify(sent)).not.toContain("Testcase");
    expect(pageText()).not.toContain(SECRET);
    expect(consoleError).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it("says the error was not recorded when the server rejects the report", async () => {
    reportClientError.mockResolvedValue(false);
    render(<RouteError error={new TypeError("x")} retry={() => {}} message="x" />);
    await waitFor(() => expect(reference()).toBe("Reference: not recorded"));
  });

  it("reports a browser error once even when Strict Mode runs the effect twice", async () => {
    render(
      <StrictMode>
        <RouteError error={new TypeError("once")} retry={() => {}} message="x" />
      </StrictMode>,
    );
    await waitFor(() => expect(reference()).toMatch(/^Reference: [0-9A-F]{10}$/));
    expect(reportClientError).toHaveBeenCalledOnce();
  });

  it("Try again calls Next's retry", () => {
    const retry = vi.fn();
    render(<RouteError error={serverError()} retry={retry} message="x" />);
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(retry).toHaveBeenCalledOnce();
  });

  it("offers a way back", () => {
    render(<RouteError error={serverError()} retry={() => {}} message="x" backHref="/patients" backLabel="Back to patients" />);
    expect(screen.getByRole("link", { name: "Back to patients" }).getAttribute("href")).toBe("/patients");
  });

  it("full-page variant carries its own landmark and synthetic-data banner", () => {
    render(<RouteError error={serverError()} retry={() => {}} message="x" fullPage />);
    expect(screen.getByRole("main").contains(screen.getByRole("alert"))).toBe(true);
    expect(pageText()).toMatch(/synthetic/i);
  });
});
