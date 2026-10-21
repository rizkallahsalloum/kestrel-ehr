"use client"; // Keyboard shortcut, idle timer and sessionStorage state only exist in the browser.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
  type RefObject,
} from "react";
import { PRIVACY_IDLE_MS } from "../config";
import { createIdleTimer } from "../idle-timer";
import { getPrivacyStore } from "../store";

type PrivacyContextValue = {
  on: boolean;
  hide: () => void;
  show: () => void;
  toggle: () => void;
  /** Polite announcement for the live region next to the Privacy button. */
  message: string;
  privacyButtonRef: RefObject<HTMLButtonElement | null>;
  showButtonRef: RefObject<HTMLButtonElement | null>;
};

const PrivacyContext = createContext<PrivacyContextValue | null>(null);

export function usePrivacy(): PrivacyContextValue {
  const value = useContext(PrivacyContext);
  if (!value) throw new Error("usePrivacy must be used inside PrivacyProvider");
  return value;
}

const ACTIVITY_EVENTS = ["pointerdown", "pointermove", "keydown", "input", "touchstart", "wheel", "scroll"] as const;

/** Ctrl+. on Windows and Linux, Cmd+. on macOS. */
function isShortcut(event: KeyboardEvent): boolean {
  return event.key === "." && (event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey;
}

/**
 * Privacy mode for the signed-in shell: hides the content area on demand (button or Ctrl/Cmd+.)
 * and after `idleMs` without activity. Client-side shoulder-surfing protection only: the data is
 * already in the page.
 */
export function PrivacyProvider({ idleMs = PRIVACY_IDLE_MS, children }: { idleMs?: number; children: ReactNode }) {
  const store = getPrivacyStoreSafe();
  const on = useSyncExternalStore(store.subscribe, store.get, () => false);
  const [message, setMessage] = useState("");
  const privacyButtonRef = useRef<HTMLButtonElement>(null);
  const showButtonRef = useRef<HTMLButtonElement>(null);

  // The pre-paint script sets the attribute; React's development remount of <html> clears it.
  useLayoutEffect(() => store.applyAttribute(), [store]);

  const hide = useCallback(() => {
    if (store.get()) return;
    store.set(true);
    setMessage("Content hidden");
    // The overlay is shown by the attribute the store just set, so it can take focus now.
    showButtonRef.current?.focus();
  }, [store]);

  const show = useCallback(() => {
    if (!store.get()) return;
    store.set(false);
    setMessage("Content shown");
    privacyButtonRef.current?.focus();
  }, [store]);

  const toggle = useCallback(() => (store.get() ? show() : hide()), [store, show, hide]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!isShortcut(event)) return;
      // A modal dialog keeps focus inside itself; hiding the page under it would leave focus nowhere.
      if (document.querySelector("dialog[open]")) return;
      event.preventDefault();
      toggle();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [toggle]);

  useEffect(() => {
    if (on) return;
    const timer = createIdleTimer({
      idleMs,
      onIdle: () => {
        const dialogs = document.querySelectorAll("dialog[open]");
        dialogs.forEach((dialog) => (dialog as HTMLDialogElement).close());
        // Dialogs return focus to their trigger in the close event; hide after that has run.
        if (dialogs.length > 0) setTimeout(hide, 0);
        else hide();
      },
    });
    const activity = () => timer.activity();
    const options = { capture: true, passive: true } as const;
    ACTIVITY_EVENTS.forEach((type) => document.addEventListener(type, activity, options));
    document.addEventListener("visibilitychange", timer.check);
    timer.start();
    return () => {
      timer.stop();
      ACTIVITY_EVENTS.forEach((type) => document.removeEventListener(type, activity, options));
      document.removeEventListener("visibilitychange", timer.check);
    };
  }, [on, idleMs, hide]);

  const value = useMemo(
    () => ({ on, hide, show, toggle, message, privacyButtonRef, showButtonRef }),
    [on, hide, show, toggle, message],
  );
  return <PrivacyContext.Provider value={value}>{children}</PrivacyContext.Provider>;
}

/** Server render has no window; a no-op store keeps the server snapshot (off). */
const SERVER_STORE = {
  get: () => false,
  set: () => {},
  clear: () => {},
  forget: () => {},
  applyAttribute: () => {},
  subscribe: () => () => {},
};

function getPrivacyStoreSafe() {
  return typeof window === "undefined" ? SERVER_STORE : getPrivacyStore();
}
