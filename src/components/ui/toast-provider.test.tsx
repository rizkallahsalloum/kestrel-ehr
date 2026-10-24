import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider, useToast } from "./toast-provider";
import { TOAST_DURATION_MS } from "./toast-queue";

function Trigger({ message = "Draft saved." }: { message?: string }) {
  const notify = useToast();
  return (
    <button type="button" onClick={() => notify(message)}>
      Run action
    </button>
  );
}

function setup() {
  render(
    <ToastProvider>
      <Trigger />
    </ToastProvider>,
  );
  const trigger = screen.getByRole("button", { name: "Run action" });
  trigger.focus();
  fireEvent.click(trigger);
  return { trigger, region: document.querySelector<HTMLElement>("[data-toast-region]")! };
}

const toasts = () => document.querySelectorAll("[data-toast]");
const dismissButton = () => screen.getByRole("button", { name: "Dismiss: Draft saved" });

describe("ToastProvider", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("is visual only: no live region, the message is in the dismiss name, and focus stays put", () => {
    const { trigger, region } = setup();
    expect(region.textContent).toContain("Draft saved.");
    expect(region.closest("[aria-live], [role=status], [role=alert], [role=log]")).toBeNull();
    expect(region.querySelector("[aria-live], [role=status], [role=alert], [role=log]")).toBeNull();
    expect(dismissButton()).toBeTruthy();
    expect(document.activeElement).toBe(trigger);
  });

  it("dismisses itself after six seconds, not before", () => {
    setup();
    act(() => vi.advanceTimersByTime(TOAST_DURATION_MS - 1));
    expect(toasts()).toHaveLength(1);
    act(() => vi.advanceTimersByTime(1));
    expect(toasts()).toHaveLength(0);
  });

  it("pauses while hovered and keeps the remaining time", () => {
    const { region } = setup();
    act(() => vi.advanceTimersByTime(4000));
    fireEvent.mouseEnter(region.querySelector("[data-toast]")!);
    act(() => vi.advanceTimersByTime(10_000));
    expect(toasts()).toHaveLength(1);
    fireEvent.mouseLeave(region.querySelector("[data-toast]")!);
    act(() => vi.advanceTimersByTime(1999));
    expect(toasts()).toHaveLength(1);
    act(() => vi.advanceTimersByTime(1));
    expect(toasts()).toHaveLength(0);
  });

  it("pauses while focused; Escape dismisses and returns focus to where it was", () => {
    const { trigger } = setup();
    const dismiss = dismissButton();
    act(() => dismiss.focus());
    act(() => vi.advanceTimersByTime(TOAST_DURATION_MS * 2));
    expect(toasts()).toHaveLength(1);
    fireEvent.keyDown(dismiss, { key: "Escape" });
    expect(toasts()).toHaveLength(0);
    expect(document.activeElement).toBe(trigger);
  });

  it("the dismiss button closes the toast", () => {
    setup();
    fireEvent.click(dismissButton());
    expect(toasts()).toHaveLength(0);
  });
});
