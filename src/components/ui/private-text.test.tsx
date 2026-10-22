import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PrivacyMaskContext, PRIVACY_MASK, PrivateText } from "./private-text";

const masked = { masked: true, epoch: 1, revealMs: 10_000, announce: () => {}, trackReveal: () => {} };

describe("PrivateText", () => {
  it("renders the value unchanged without Privacy mode", () => {
    render(<PrivateText label="MRN">SYN-000101</PrivateText>);
    expect(screen.getByText("SYN-000101")).toBeTruthy();
  });

  it("renders a fixed mask, independent of the value's length, with a reveal button", () => {
    const { container } = render(
      <PrivacyMaskContext.Provider value={masked}>
        <PrivateText label="MRN">SYN-000101</PrivateText>
        <PrivateText label="Patient name">Demoson-Testcase, Mira Alexandra</PrivateText>
      </PrivacyMaskContext.Provider>,
    );
    expect(container.textContent).toBe(PRIVACY_MASK + PRIVACY_MASK);
    expect(screen.getByRole("button", { name: "MRN hidden, press to reveal" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Patient name hidden, press to reveal" })).toBeTruthy();
  });

  it("renders a non-interactive mask where a button is not allowed (inside a link)", () => {
    render(
      <PrivacyMaskContext.Provider value={masked}>
        <a href="#chart">
          <PrivateText label="Patient name" revealable={false}>
            Testcase, Rowan
          </PrivateText>
        </a>
      </PrivacyMaskContext.Provider>,
    );
    expect(screen.getByRole("link", { name: "Patient name hidden" })).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });
});
