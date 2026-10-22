import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FormField, PrivateField, PrivateText, TextArea } from "@/components/ui";
import { PRIVACY_FIELD_REVEAL_MS, PRIVACY_IDLE_MS, PRIVACY_IDLE_STORAGE_KEY, PRIVACY_STORAGE_KEY } from "../config";
import { getIdleSettingStore, getPrivacyStore } from "../store";
import { PrivacyButton } from "./privacy-controls";
import { PrivacyProvider } from "./privacy-provider";

function Shell({ idleMs, revealMs = 10_000 }: { idleMs?: number; revealMs?: number }) {
  return (
    <PrivacyProvider idleMs={idleMs} revealMs={revealMs}>
      <PrivacyButton />
      <p>
        Name: <PrivateText label="Patient name">Testcase, Rowan</PrivateText>
      </p>
      <p>
        MRN: <PrivateText label="MRN">SYN-000101</PrivateText>
      </p>
      <FormField id="notes" label="Notes">
        <PrivateField label="Notes">
          <TextArea defaultValue="Synthetic note" />
        </PrivateField>
      </FormField>
      <dialog data-testid="dialog">
        <PrivateText label="Cancel reason">Duplicate order</PrivateText>
      </dialog>
    </PrivacyProvider>
  );
}

const privacyButton = () => screen.getByRole("button", { name: /^Privacy( on)?$/ });
const isOn = () => document.documentElement.getAttribute("data-privacy") === "on";
const live = () => document.querySelector("[aria-live=polite]")!.textContent;
const reveal = (label: string) => screen.getByRole("button", { name: `${label} hidden, press to reveal` });
const bodyText = () => document.body.textContent ?? "";

beforeEach(() => {
  getPrivacyStore().clear();
  getIdleSettingStore().clear();
});

afterEach(() => {
  vi.useRealTimers();
  getPrivacyStore().clear();
  getIdleSettingStore().clear();
});

describe("Privacy config", () => {
  it("hides after 60s idle and re-masks a revealed field after 10s", () => {
    expect(PRIVACY_IDLE_MS).toBe(60_000);
    expect(PRIVACY_FIELD_REVEAL_MS).toBe(10_000);
  });
});

describe("PrivacyProvider", () => {
  it("masks every private value in place from the button and keeps focus on the button", () => {
    render(<Shell />);
    expect(privacyButton().getAttribute("aria-pressed")).toBe("false");
    expect(bodyText()).toContain("Testcase, Rowan");

    privacyButton().focus();
    fireEvent.click(privacyButton());
    expect(isOn()).toBe(true);
    expect(sessionStorage.getItem(PRIVACY_STORAGE_KEY)).toBe("on");
    expect(privacyButton().getAttribute("aria-pressed")).toBe("true");
    expect(bodyText()).not.toContain("Testcase");
    expect(bodyText()).not.toContain("SYN-000101");
    expect(bodyText()).not.toContain("Duplicate order");
    expect(reveal("Patient name")).toBeTruthy();
    expect(reveal("MRN")).toBeTruthy();
    // The control stays mounted (unsaved value kept), hidden from assistive technology.
    const notes = document.querySelector("textarea")!;
    expect(notes.closest("[inert]")).not.toBeNull();
    expect(notes.closest("[aria-hidden=true]")).not.toBeNull();
    expect(reveal("Notes")).toBeTruthy();
    expect(document.activeElement).toBe(privacyButton());
    expect(live()).toBe("Patient details hidden");

    fireEvent.click(privacyButton());
    expect(isOn()).toBe(false);
    expect(sessionStorage.getItem(PRIVACY_STORAGE_KEY)).toBeNull();
    expect(bodyText()).toContain("Testcase, Rowan");
    expect(notes.closest("[inert]")).toBeNull();
    expect(document.activeElement).toBe(privacyButton());
    expect(live()).toBe("Patient details shown");
  });

  it("names the pill after its visible label and swaps the eye icon for eye-off when on", () => {
    render(<Shell />);
    const button = privacyButton();
    expect(screen.getByRole("button", { name: "Privacy" })).toBe(button);
    expect(button.querySelector("svg")?.getAttribute("data-icon")).toBe("eye");
    expect(button.getAttribute("aria-keyshortcuts")).toBe("Control+. Meta+.");
    fireEvent.click(button);
    expect(screen.getByRole("button", { name: "Privacy on" })).toBe(button);
    expect(button.querySelector("svg")?.getAttribute("data-icon")).toBe("eye-off");
    // Both labels stay in the layout so the pill keeps its width; only the current one is exposed.
    const labels = Array.from(button.querySelectorAll("span > span")).map((span) => span.textContent);
    expect(labels).toEqual(["Privacy", "Privacy on"]);
  });

  it("toggles with Ctrl+. and Cmd+., including from a text field and inside an open dialog", () => {
    render(<Shell />);
    const notes = screen.getByLabelText("Notes");
    notes.focus();
    fireEvent.keyDown(notes, { key: ".", ctrlKey: true });
    expect(isOn()).toBe(true);
    fireEvent.keyDown(document.body, { key: ".", metaKey: true });
    expect(isOn()).toBe(false);
    fireEvent.keyDown(document.body, { key: ".", ctrlKey: true, shiftKey: true });
    expect(isOn()).toBe(false);

    const dialog = screen.getByTestId("dialog") as HTMLDialogElement;
    dialog.showModal();
    fireEvent.keyDown(dialog, { key: ".", ctrlKey: true });
    expect(isOn()).toBe(true);
    expect(dialog.open).toBe(true);
  });

  it("reads the stored state on mount, so the next page in the tab starts masked", () => {
    getPrivacyStore().set(true);
    render(<Shell />);
    expect(privacyButton().getAttribute("aria-pressed")).toBe("true");
    expect(bodyText()).not.toContain("Testcase");
  });

  describe("per-field reveal", () => {
    beforeEach(() => vi.useFakeTimers());

    it("shows only the revealed field, announces it, and masks it again after the reveal period", () => {
      render(<Shell />);
      fireEvent.click(privacyButton());
      reveal("Patient name").focus();
      fireEvent.click(reveal("Patient name"));
      expect(bodyText()).toContain("Testcase, Rowan");
      expect(bodyText()).not.toContain("SYN-000101");
      expect(live()).toBe("Patient name shown");
      // Focus stays on the field: the revealed value takes it.
      expect(document.activeElement?.textContent).toBe("Testcase, Rowan");

      act(() => vi.advanceTimersByTime(9_999));
      expect(bodyText()).toContain("Testcase, Rowan");
      act(() => vi.advanceTimersByTime(1));
      expect(bodyText()).not.toContain("Testcase");
      expect(live()).toBe("Patient name hidden");
      expect(document.activeElement).toBe(reveal("Patient name"));
    });

    it("keeps a revealed form control visible while focus is inside it, then masks it after the period", () => {
      render(<Shell />);
      fireEvent.click(privacyButton());
      fireEvent.click(reveal("Notes"));
      const notes = document.querySelector("textarea")!;
      expect(document.activeElement).toBe(notes);
      act(() => vi.advanceTimersByTime(30_000));
      expect(notes.closest("[inert]")).toBeNull();

      act(() => notes.blur());
      act(() => vi.advanceTimersByTime(10_000));
      expect(notes.closest("[inert]")).not.toBeNull();
      expect(notes.value).toBe("Synthetic note");
    });

    it("turning Privacy off and on again masks every revealed field", () => {
      render(<Shell />);
      fireEvent.click(privacyButton());
      fireEvent.click(reveal("MRN"));
      fireEvent.click(privacyButton());
      fireEvent.click(privacyButton());
      expect(bodyText()).not.toContain("SYN-000101");
    });
  });

  describe("auto-hide", () => {
    beforeEach(() => vi.useFakeTimers());

    it("uses the auto-hide choice stored for the tab, 1 minute by default", () => {
      sessionStorage.setItem(PRIVACY_IDLE_STORAGE_KEY, "30000");
      render(<Shell />);
      act(() => vi.advanceTimersByTime(29_999));
      expect(isOn()).toBe(false);
      act(() => vi.advanceTimersByTime(1));
      expect(isOn()).toBe(true);
    });

    it("picks up a new choice without a reload, and ignores values that are not offered", () => {
      sessionStorage.setItem(PRIVACY_IDLE_STORAGE_KEY, "5000");
      render(<Shell />);
      expect(getIdleSettingStore().get()).toBe(PRIVACY_IDLE_MS);
      act(() => getIdleSettingStore().set(120_000));
      expect(sessionStorage.getItem(PRIVACY_IDLE_STORAGE_KEY)).toBe("120000");
      act(() => vi.advanceTimersByTime(119_999));
      expect(isOn()).toBe(false);
      act(() => vi.advanceTimersByTime(1));
      expect(isOn()).toBe(true);
    });

    it("masks after the idle period and resets on pointer, scroll and touch activity", () => {
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
      expect(live()).toBe("Patient details hidden");
    });

    it("does not mask while the user keeps typing in a field; masks a full period after the last keystroke", () => {
      render(<Shell idleMs={60_000} />);
      const notes = screen.getByLabelText("Notes") as HTMLTextAreaElement;
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
      expect(notes.value).toBe("Synthetic note 5");
    });

    it("re-masks fields revealed while Privacy mode is on, with one announcement", () => {
      render(<Shell idleMs={60_000} revealMs={120_000} />);
      fireEvent.click(privacyButton());
      fireEvent.click(reveal("Patient name"));
      fireEvent.click(reveal("MRN"));
      expect(bodyText()).toContain("SYN-000101");
      act(() => vi.advanceTimersByTime(60_000));
      expect(bodyText()).not.toContain("Testcase");
      expect(bodyText()).not.toContain("SYN-000101");
      expect(live()).toBe("Patient details hidden");
    });

    it("leaves an open dialog open; its values are masked in place", () => {
      render(<Shell idleMs={60_000} />);
      const dialog = screen.getByTestId("dialog") as HTMLDialogElement;
      dialog.showModal();
      act(() => vi.advanceTimersByTime(60_000));
      expect(isOn()).toBe(true);
      expect(dialog.open).toBe(true);
      expect(dialog.textContent).not.toContain("Duplicate order");
    });
  });
});
