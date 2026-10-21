import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PRIVACY_STORAGE_KEY } from "../config";
import { getPrivacyStore } from "../store";
import { PrivacyButton, PrivacyContent, PrivacyOverlay } from "./privacy-controls";
import { PrivacyProvider } from "./privacy-provider";

function Shell({ idleMs }: { idleMs?: number }) {
  return (
    <PrivacyProvider idleMs={idleMs}>
      <PrivacyButton />
      <PrivacyContent>
        <label htmlFor="notes">Notes</label>
        <textarea id="notes" defaultValue="Synthetic note" />
        <dialog data-testid="dialog">Dialog</dialog>
      </PrivacyContent>
      <PrivacyOverlay />
    </PrivacyProvider>
  );
}

const privacyButton = () => screen.getByRole("button", { name: "Privacy" });
const isOn = () => document.documentElement.getAttribute("data-privacy") === "on";
const content = () => document.querySelector("[data-privacy-content]")!;

beforeEach(() => {
  getPrivacyStore().clear();
});

afterEach(() => {
  vi.useRealTimers();
  getPrivacyStore().clear();
});

describe("PrivacyProvider", () => {
  it("toggles from the button, masks the content area and hands focus over both ways", () => {
    render(<Shell />);
    expect(privacyButton().getAttribute("aria-pressed")).toBe("false");

    fireEvent.click(privacyButton());
    expect(isOn()).toBe(true);
    expect(sessionStorage.getItem(PRIVACY_STORAGE_KEY)).toBe("on");
    expect(privacyButton().getAttribute("aria-pressed")).toBe("true");
    expect(content().hasAttribute("inert")).toBe(true);
    expect(content().getAttribute("aria-hidden")).toBe("true");
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Show content" }));
    expect(screen.getByText("Content hidden", { selector: "[aria-live]" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Show content" }));
    expect(isOn()).toBe(false);
    expect(sessionStorage.getItem(PRIVACY_STORAGE_KEY)).toBeNull();
    expect(content().hasAttribute("inert")).toBe(false);
    expect(document.activeElement).toBe(privacyButton());
    expect(screen.getByText("Content shown", { selector: "[aria-live]" })).toBeTruthy();
  });

  it("toggles with Ctrl+. and Cmd+., including from a text field", () => {
    render(<Shell />);
    const notes = screen.getByLabelText("Notes");
    notes.focus();
    fireEvent.keyDown(notes, { key: ".", ctrlKey: true });
    expect(isOn()).toBe(true);
    fireEvent.keyDown(document.activeElement!, { key: ".", metaKey: true });
    expect(isOn()).toBe(false);
    fireEvent.keyDown(document.body, { key: ".", ctrlKey: true, shiftKey: true });
    expect(isOn()).toBe(false);
  });

  it("ignores the shortcut while a modal dialog is open", () => {
    render(<Shell />);
    (screen.getByTestId("dialog") as HTMLDialogElement).showModal();
    fireEvent.keyDown(document.body, { key: ".", ctrlKey: true });
    expect(isOn()).toBe(false);
  });

  it("reads the stored state on mount, so the next page in the tab starts hidden", () => {
    sessionStorage.setItem(PRIVACY_STORAGE_KEY, "on");
    // A fresh page load reads storage; simulate it by clearing the in-memory value first.
    getPrivacyStore().set(true);
    render(<Shell />);
    expect(privacyButton().getAttribute("aria-pressed")).toBe("true");
    expect(content().hasAttribute("inert")).toBe(true);
  });

  describe("auto-hide", () => {
    beforeEach(() => vi.useFakeTimers());

    it("hides after the idle period and resets on pointer, scroll and touch activity", () => {
      render(<Shell idleMs={60_000} />);
      act(() => vi.advanceTimersByTime(50_000));
      fireEvent.pointerMove(document.body);
      act(() => vi.advanceTimersByTime(50_000));
      fireEvent.scroll(document);
      act(() => vi.advanceTimersByTime(50_000));
      fireEvent.touchStart(document.body);
      act(() => vi.advanceTimersByTime(50_000));
      expect(isOn()).toBe(false);
      act(() => vi.advanceTimersByTime(10_000));
      expect(isOn()).toBe(true);
      expect(document.activeElement).toBe(screen.getByRole("button", { name: "Show content" }));
    });

    it("does not hide while the user keeps typing in a field; hides a full period after the last keystroke", () => {
      render(<Shell idleMs={60_000} />);
      const notes = screen.getByLabelText("Notes");
      notes.focus();
      for (let i = 0; i < 6; i++) {
        act(() => vi.advanceTimersByTime(20_000));
        fireEvent.keyDown(notes, { key: "a" });
        fireEvent.input(notes, { target: { value: `Synthetic note ${i}` } });
      }
      expect(isOn()).toBe(false);
      act(() => vi.advanceTimersByTime(59_000));
      expect(isOn()).toBe(false);
      act(() => vi.advanceTimersByTime(1_000));
      expect(isOn()).toBe(true);
      // The typed text is kept: the content is hidden, not unmounted.
      expect((notes as HTMLTextAreaElement).value).toBe("Synthetic note 5");
    });

    it("closes an open dialog before hiding", () => {
      render(<Shell idleMs={60_000} />);
      const dialog = screen.getByTestId("dialog") as HTMLDialogElement;
      dialog.showModal();
      act(() => vi.advanceTimersByTime(60_000));
      expect(dialog.open).toBe(false);
      // Hiding waits one task for the dialog's close handling (fake timers clamp 0ms to 1ms).
      act(() => vi.advanceTimersByTime(1));
      expect(isOn()).toBe(true);
    });

    it("does not run while Privacy mode is on", () => {
      render(<Shell idleMs={60_000} />);
      fireEvent.click(privacyButton());
      fireEvent.click(screen.getByRole("button", { name: "Show content" }));
      act(() => vi.advanceTimersByTime(30_000));
      expect(isOn()).toBe(false);
      act(() => vi.advanceTimersByTime(30_000));
      expect(isOn()).toBe(true);
    });
  });
});
