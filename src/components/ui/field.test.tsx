import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FormErrors, FormField, SelectInput, TextInput } from "./field";

describe("FormField", () => {
  it("labels the control and links helper text", () => {
    render(
      <FormField id="quantity" label="Quantity" helper="Tablets to dispense." required>
        <TextInput name="quantity" />
      </FormField>,
    );
    const input = screen.getByRole("textbox", { name: "Quantity" });
    expect(input.id).toBe("quantity");
    expect(input.getAttribute("aria-required")).toBe("true");
    expect(input.getAttribute("aria-invalid")).toBeNull();
    const describedBy = input.getAttribute("aria-describedby");
    expect(describedBy && document.getElementById(describedBy)?.textContent).toBe("Tablets to dispense.");
  });

  it("replaces the helper with an announced error and marks the control invalid", () => {
    render(
      <FormField id="quantity" label="Quantity" helper="Tablets to dispense." errors={["Enter a whole number of 1 or more."]}>
        <TextInput name="quantity" />
      </FormField>,
    );
    const input = screen.getByLabelText("Quantity");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toBe("Enter a whole number of 1 or more.");
    expect(input.getAttribute("aria-describedby")).toBe(alert.id);
    expect(screen.queryByText("Tablets to dispense.")).toBeNull();
  });

  it("does not use red for form errors", () => {
    render(
      <FormField id="dose" label="Dose" errors="Required.">
        <SelectInput name="dose">
          <option value="">Choose</option>
        </SelectInput>
      </FormField>,
    );
    const alert = screen.getByRole("alert");
    expect(alert.className).toContain("text-warning");
    expect(alert.className).not.toMatch(/danger/);
  });

  it("keeps an existing aria-describedby on the child", () => {
    render(
      <FormField id="start" label="Start date" helper="Today or later.">
        <TextInput name="start" aria-describedby="external-hint" />
      </FormField>,
    );
    expect(screen.getByLabelText("Start date").getAttribute("aria-describedby")).toBe("external-hint start-message");
  });
});

describe("TextInput", () => {
  it("shows an em dash and a screen-reader 'No value' when read-only and empty", () => {
    render(
      <FormField id="supply" label="Days supply">
        <TextInput readOnly value="" />
      </FormField>,
    );
    const input = screen.getByLabelText("Days supply") as HTMLInputElement;
    expect(input.placeholder).toBe("\u2014");
    expect(input.getAttribute("aria-describedby")).toBe("supply-empty");
    expect(document.getElementById("supply-empty")?.textContent).toBe("No value");
  });
});

describe("FormErrors", () => {
  it("renders nothing without messages and an alert with them", () => {
    const { container, rerender } = render(<FormErrors messages={[]} />);
    expect(container.innerHTML).toBe("");
    rerender(<FormErrors messages={["Email or password is incorrect."]} />);
    expect(screen.getByRole("alert").textContent).toContain("Email or password is incorrect.");
  });
});
