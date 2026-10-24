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
  return { trigger, region: screen.getByRole("status") };
}

const toasts = () => document.querySelectorAll("[data-toast]");

describe("ToastProvider", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("announces in one polite status region and does not take focus", () => {
    const { trigger, region } = setup();
    expect(region.getAttribute("aria-live")).toBe("polite");
    expect(region.textContent).toContain("Draft saved.");
    expect(document.activeElement).toBe(trigger);
    expect(screen.queryByRole("alert")).toBeNull();
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
    const dismiss = screen.getByRole("button", { name: "Dismiss notification" });
    act(() => dismiss.focus());
    act(() => vi.advanceTimersByTime(TOAST_DURATION_MS * 2));
    expect(toasts()).toHaveLength(1);
    fireEvent.keyDown(dismiss, { key: "Escape" });
    expect(toasts()).toHaveLength(0);
    expect(document.activeElement).toBe(trigger);
  });

  it("the dismiss button closes the toast", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Dismiss notification" }));
    expect(toasts()).toHaveLength(0);
  });
});
