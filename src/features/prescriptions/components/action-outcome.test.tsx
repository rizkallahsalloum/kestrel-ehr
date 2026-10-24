import { render, screen } from "@testing-library/react";
import { StrictMode } from "react";
import { describe, expect, it } from "vitest";
import { ActionOutcome } from "./action-outcome";

function Page({ message }: { message: string }) {
  return (
    <StrictMode>
      <button type="button">Run action</button>
      <h2 id="target" tabIndex={-1}>
        Review prescription
      </h2>
      <ActionOutcome message={message} focusId="target" />
    </StrictMode>
  );
}

describe("ActionOutcome", () => {
  it("is a polite status region and leaves focus alone on first render", () => {
    render(<Page message="Draft saved as version 1." />);
    expect(screen.getByRole("status").textContent).toBe("Draft saved as version 1.");
    expect(document.activeElement).toBe(document.body);
  });

  it("moves focus to the heading when the message changes", () => {
    const { rerender } = render(<Page message="Draft saved as version 1." />);
    screen.getByRole("button").focus();
    rerender(<Page message="Draft saved as version 2." />);
    expect(screen.getByRole("status").textContent).toBe("Draft saved as version 2.");
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "Review prescription" }));
  });

  it("does not move focus when a refresh keeps the same message", () => {
    const { rerender } = render(<Page message="Draft saved as version 1." />);
    screen.getByRole("button").focus();
    rerender(<Page message="Draft saved as version 1." />);
    expect(document.activeElement).toBe(screen.getByRole("button"));
  });
});
