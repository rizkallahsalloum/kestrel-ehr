import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Button, buttonStyles } from "./button";
import { AttestationCheck } from "./choice";

describe("Button", () => {
  it("does not submit forms unless asked to", () => {
    const onSubmit = vi.fn((event: { preventDefault: () => void }) => event.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <Button>Plain</Button>
        <Button type="submit">Save</Button>
      </form>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Plain" }));
    expect(onSubmit).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("uses the size tokens and the disabled opacity token", () => {
    expect(buttonStyles({ size: "cta" })).toContain("min-h-cta");
    expect(buttonStyles({ variant: "secondary", size: "sm" })).toContain("min-h-control-sm");
    expect(buttonStyles()).toContain("disabled:opacity-(--opacity-disabled)");
  });
});

describe("AttestationCheck", () => {
  it("is a labelled checkbox", () => {
    render(<AttestationCheck name="attestation" label="I reviewed this synthetic draft." />);
    const box = screen.getByRole("checkbox", { name: "I reviewed this synthetic draft." }) as HTMLInputElement;
    fireEvent.click(box);
    expect(box.checked).toBe(true);
  });
});
