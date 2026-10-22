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
} from "react";
import {
  PRIVACY_MEASURE_EVENT,
  PRIVATE_FOCUS_SELECTOR,
  PrivacyMaskContext,
  type PrivacyMaskState,
} from "@/components/ui";
import { PRIVACY_FIELD_REVEAL_MS, PRIVACY_IDLE_MS } from "../config";
import { createIdleTimer } from "../idle-timer";
import { getIdleSettingStore, getPrivacyStore } from "../store";

type Announcement = { text: string; id: number };

type PrivacyContextValue = {
  on: boolean;
  toggle: () => void;
  /** Polite announcement for the live region next to the Privacy button; `id` changes on every call. */
  announcement: Announcement;
  /** Queues a polite announcement in that live region. */
  announce: (text: string) => void;
  /** Auto-hide delay in use ("Privacy auto-hide" in the user menu). */
  idleMs: number;
  setIdleMs: (ms: number) => void;
};

const PrivacyContext = createContext<PrivacyContextValue | null>(null);

export function usePrivacy(): PrivacyContextValue {
  const value = useContext(PrivacyContext);
  if (!value) throw new Error("usePrivacy must be used inside PrivacyProvider");
  return value;
}

const ACTIVITY_EVENTS = ["pointerdown", "pointermove", "keydown", "input", "touchstart", "wheel", "scroll"] as const;

function focusedPrivateField(): Element | null {
  return document.activeElement?.closest("[data-private]") ?? null;
}

/** Ctrl+. on Windows and Linux, Cmd+. on macOS. */
function isShortcut(event: KeyboardEvent): boolean {
  return event.key === "." && (event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey;
}

/**
 * Privacy mode for the signed-in shell: masks every `PrivateText` and `PrivateField` in place, on
 * demand (button or Ctrl/Cmd+.) and after the auto-hide delay without activity, which also re-masks
 * fields revealed one by one. The delay is the user's sessionStorage choice unless `idleMs` is passed.
 * Client-side shoulder-surfing protection only: the data is already in the page.
 */
export function PrivacyProvider({
  idleMs: idleMsOverride,
  revealMs = PRIVACY_FIELD_REVEAL_MS,
  children,
}: {
  idleMs?: number;
  revealMs?: number;
  children: ReactNode;
}) {
  const store = getPrivacyStoreSafe();
  const on = useSyncExternalStore(store.subscribe, store.get, () => false);
  const idleStore = getIdleSettingStoreSafe();
  const storedIdleMs = useSyncExternalStore(idleStore.subscribe, idleStore.get, () => PRIVACY_IDLE_MS);
  const idleMs = idleMsOverride ?? storedIdleMs;
  const [epoch, setEpoch] = useState(0);
  const [announcement, setAnnouncement] = useState<Announcement>({ text: "", id: 0 });
  const revealed = useRef(0);
  const focusedField = useRef<Element | null>(null);

  // The pre-paint script sets the attribute; React's development remount of <html> clears it.
  useLayoutEffect(() => store.applyAttribute(), [store]);

  const announce = useCallback((text: string) => setAnnouncement((a) => ({ text, id: a.id + 1 })), []);
  const trackReveal = useCallback((delta: 1 | -1) => {
    revealed.current += delta;
  }, []);

  // Focus stays where it is: if it was on a private value or its mask, it moves to the element that
  // replaced it in the same field.
  useLayoutEffect(() => {
    const field = focusedField.current;
    focusedField.current = null;
    const active = document.activeElement;
    // A control that just became inert still reports focus until the browser's next focus fixup.
    if (field?.isConnected && (!field.contains(active) || active?.closest("[inert]"))) {
      field.querySelector<HTMLElement>(PRIVATE_FOCUS_SELECTOR)?.focus();
    }
  }, [on, epoch]);

  const hide = useCallback(() => {
    focusedField.current = focusedPrivateField();
    window.dispatchEvent(new Event(PRIVACY_MEASURE_EVENT));
    if (!store.get()) store.set(true);
    setEpoch((e) => e + 1);
    announce("Patient details hidden");
  }, [store, announce]);

  const show = useCallback(() => {
    if (!store.get()) return;
    focusedField.current = focusedPrivateField();
    store.set(false);
    announce("Patient details shown");
  }, [store, announce]);

  const toggle = useCallback(() => (store.get() ? show() : hide()), [store, show, hide]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!isShortcut(event)) return;
      event.preventDefault();
      toggle();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [toggle]);

  useEffect(() => {
    const timer = createIdleTimer({
      idleMs,
      onIdle: () => {
        // Off: mask everything. On: mask again any field revealed on its own.
        if (!store.get() || revealed.current > 0) hide();
        timer.start();
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
  }, [idleMs, hide, store]);

  const mask = useMemo<PrivacyMaskState>(
    () => ({ masked: on, epoch, revealMs, announce, trackReveal }),
    [on, epoch, revealMs, announce, trackReveal],
  );
  const value = useMemo(
    () => ({ on, toggle, announcement, announce, idleMs, setIdleMs: idleStore.set }),
    [on, toggle, announcement, announce, idleMs, idleStore],
  );
  return (
    <PrivacyContext.Provider value={value}>
      <PrivacyMaskContext.Provider value={mask}>{children}</PrivacyMaskContext.Provider>
    </PrivacyContext.Provider>
  );
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

const SERVER_IDLE_STORE = {
  get: () => PRIVACY_IDLE_MS,
  set: () => {},
  clear: () => {},
  subscribe: () => () => {},
};

function getIdleSettingStoreSafe() {
  return typeof window === "undefined" ? SERVER_IDLE_STORE : getIdleSettingStore();
}
