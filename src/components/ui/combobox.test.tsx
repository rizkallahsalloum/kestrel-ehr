import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { Combobox, type ComboboxOption } from "./combobox";

const OPTIONS: ComboboxOption[] = [
  { value: "a", label: "Demozolam 5 mg", meta: "DEMO-AAA" },
  { value: "b", label: "Testoprilat 10 mg", meta: "DEMO-BBB" },
  { value: "c", label: "Demorphate 2 mg", meta: "DEMO-CCC" },
];

function Harness({ onChange = () => {}, status }: { onChange?: (v: string | null) => void; status?: "loading" | "error" }) {
  const [value, setValue] = useState<string | null>(null);
  return (
    <form>
      <label htmlFor="med">Medication</label>
      <Combobox
        id="med"
        name="medicationId"
        options={OPTIONS}
        value={value}
        status={status}
        onValueChange={(v) => {
          setValue(v);
          onChange(v);
        }}
      />
    </form>
  );
}

const input = () => screen.getByRole("combobox", { name: "Medication" }) as HTMLInputElement;
const options = () => screen.queryAllByRole("option");

describe("Combobox", () => {
  it("opens on focus and filters by typed text", () => {
    render(<Harness />);
    fireEvent.focus(input());
    expect(input().getAttribute("aria-expanded")).toBe("true");
    expect(options()).toHaveLength(3);

    fireEvent.change(input(), { target: { value: "demo" } });
    expect(options().map((o) => o.textContent)).toEqual(["Demozolam 5 mgDEMO-AAA", "Demorphate 2 mgDEMO-CCC"]);
    expect(screen.getAllByText("Demo", { selector: "mark" })).toHaveLength(2);
  });

  it("moves the active option with the arrow keys and selects with Enter", () => {
    const onChange = vi.fn();
    const { container } = render(<Harness onChange={onChange} />);
    fireEvent.focus(input());
    fireEvent.keyDown(input(), { key: "ArrowDown" });
    fireEvent.keyDown(input(), { key: "ArrowDown" });
    const active = input().getAttribute("aria-activedescendant");
    expect(active && document.getElementById(active)?.textContent).toContain("Testoprilat");
    expect(document.getElementById(active!)?.getAttribute("aria-selected")).toBe("true");

    fireEvent.keyDown(input(), { key: "ArrowUp" });
    fireEvent.keyDown(input(), { key: "ArrowUp" });
    expect(document.getElementById(input().getAttribute("aria-activedescendant")!)?.textContent).toContain("Demorphate");

    fireEvent.keyDown(input(), { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith("c");
    expect(input().value).toBe("Demorphate 2 mg");
    expect(input().getAttribute("aria-expanded")).toBe("false");
    expect(container.querySelector<HTMLInputElement>('input[name="medicationId"]')?.value).toBe("c");
  });

  it("closes on Escape and restores the selected label", () => {
    render(<Harness />);
    fireEvent.focus(input());
    fireEvent.change(input(), { target: { value: "testo" } });
    fireEvent.keyDown(input(), { key: "Escape" });
    expect(input().getAttribute("aria-expanded")).toBe("false");
    expect(input().value).toBe("");
  });

  it("selects with the mouse and clears back to an empty value", () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    fireEvent.focus(input());
    fireEvent.mouseDown(screen.getByRole("option", { name: /Testoprilat/ }));
    expect(onChange).toHaveBeenLastCalledWith("b");

    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(onChange).toHaveBeenLastCalledWith(null);
    expect(input().value).toBe("");
    expect(document.activeElement).toBe(input());
  });

  it("announces no matches, loading and errors without a listbox selection", () => {
    const { rerender } = render(<Harness />);
    fireEvent.focus(input());
    fireEvent.change(input(), { target: { value: "zzz" } });
    expect(options()).toHaveLength(0);
    expect(screen.getAllByText("No matches for \u201czzz\u201d.").length).toBeGreaterThan(0);

    rerender(<Harness status="loading" />);
    expect(screen.getByText("Loading results.")).toBeTruthy();
    expect(input().getAttribute("aria-expanded")).toBe("false");

    rerender(<Harness status="error" />);
    expect(screen.getAllByText("The list could not be loaded.").length).toBeGreaterThan(0);
  });
});
