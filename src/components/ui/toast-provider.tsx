"use client"; // Holds the toast queue and timers in state and watches hover, focus and open dialogs.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { cn } from "./cn";
import { CheckCircleIcon, CloseIcon } from "./icons";
import { dismissToast, EMPTY_TOAST_QUEUE, enqueueToast, TOAST_DURATION_MS, type ToastItem } from "./toast-queue";

type Notify = (message: string) => void;
type ToastState = { visible: readonly ToastItem[]; dismiss: (id: number) => void };

const ToastContext = createContext<Notify>(() => {});
const ToastStateContext = createContext<ToastState | null>(null);

/**
 * Shows a transient success confirmation. Only for fixed, non-clinical text with no patient
 * details: never safety alerts, errors or anything that needs action (those stay inline).
 */
export function useToast(): Notify {
  return useContext(ToastContext);
}

function subscribeToDialogs(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["open"] });
  return () => observer.disconnect();
}

/** A native modal makes the rest of the page inert, so toasts wait until it closes. */
function useDialogOpen(): boolean {
  return useSyncExternalStore(
    subscribeToDialogs,
    () => document.querySelector("dialog[open]") !== null,
    () => false,
  );
}

/** The toast is not a live region, so its button name is the only way a screen reader meets the text. */
function dismissLabel(message: string): string {
  return `Dismiss: ${message.replace(/\.$/, "")}`;
}

/**
 * Older toasts sit behind the newest, each one step lower, so the deck stays inside the top bar. The
 * z order is explicit: a translated card would otherwise paint over the untranslated front one.
 */
const DECK_OFFSET = ["z-30", "z-20 translate-y-1", "z-10 translate-y-2"];

function Toast({
  toast,
  depth,
  paused,
  onDismiss,
}: {
  toast: ToastItem;
  depth: number;
  paused: boolean;
  onDismiss: (id: number, viaKeyboard: boolean) => void;
}) {
  const remaining = useRef(TOAST_DURATION_MS);

  useEffect(() => {
    if (paused) return;
    const started = Date.now();
    const timer = setTimeout(() => onDismiss(toast.id, false), remaining.current);
    return () => {
      clearTimeout(timer);
      remaining.current = Math.max(0, remaining.current - (Date.now() - started));
    };
  }, [paused, onDismiss, toast.id]);

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== "Escape") return;
    event.stopPropagation();
    onDismiss(toast.id, true);
  };

  return (
    <div
      data-toast=""
      data-toast-depth={depth}
      inert={depth > 0}
      onKeyDown={onKeyDown}
      className={cn(
        "pointer-events-auto relative col-start-1 row-start-1 flex w-full max-w-toast items-center gap-3 rounded-control bg-inverse py-xs pr-xs pl-sm text-label text-on-inverse shadow-level-2 motion-safe:animate-toast-in",
        DECK_OFFSET[depth],
      )}
    >
      <CheckCircleIcon className="shrink-0 text-on-inverse" />
      <p className="min-w-0 flex-1">{toast.message}</p>
      <button
        type="button"
        onClick={(event) => onDismiss(toast.id, event.detail === 0)}
        aria-label={dismissLabel(toast.message)}
        className="grid size-control-sm shrink-0 place-items-center rounded-control text-on-inverse hover:bg-inverse-raised focus-visible:outline-on-inverse"
      >
        <CloseIcon />
      </button>
    </div>
  );
}

/**
 * Holds the queue. Lives in the app layout, above the pages, so a toast survives the refresh after a
 * Server Action; `ToastViewport` (in the top bar) draws it.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [queue, setQueue] = useState(EMPTY_TOAST_QUEUE);
  const notify = useCallback<Notify>((message) => setQueue((q) => enqueueToast(q, message, Date.now())), []);
  const dismiss = useCallback((id: number) => setQueue((q) => dismissToast(q, id)), []);
  const state = useMemo(() => ({ visible: queue.visible, dismiss }), [queue.visible, dismiss]);

  return (
    <ToastContext value={notify}>
      <ToastStateContext value={state}>{children}</ToastStateContext>
    </ToastContext>
  );
}

/**
 * Visual-only confirmations, anchored inside the sticky top bar: below the synthetic-data banner at
 * the top of the page, at the top of the viewport once scrolled, and never over page content. Not a
 * live region: each caller already announces its outcome once (the E-Rx ActionOutcome), and a second
 * announcer would repeat it. Toasts auto-dismiss after six seconds, pause while hovered or focused,
 * close with their button or Escape, never take focus, and wait while a dialog is open. Only the
 * newest toast is interactive; the others wait behind it.
 */
export function ToastViewport() {
  const state = useContext(ToastStateContext);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const dialogOpen = useDialogOpen();
  const region = useRef<HTMLDivElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const refocus = useRef(false);
  const shown = useMemo(() => (!state || dialogOpen ? [] : state.visible), [state, dialogOpen]);

  // After a keyboard dismiss the next toast comes to the front (it was inert behind), so focus it.
  useEffect(() => {
    if (!refocus.current) return;
    refocus.current = false;
    region.current?.querySelector<HTMLElement>("[data-toast-depth='0'] button")?.focus();
  }, [shown]);

  const count = shown.length;
  const dismiss = useCallback(
    (id: number, viaKeyboard: boolean) => {
      if (viaKeyboard && count > 1) {
        refocus.current = true;
      } else if (viaKeyboard) {
        // The last toast: go back to where focus was before the user tabbed in, while the button still exists.
        const target = returnFocus.current?.isConnected ? returnFocus.current : document.getElementById("main");
        target?.focus();
      } else {
        // A removed element fires no blur or mouseleave, so the pause would otherwise stick.
        setFocused(false);
      }
      setHovered(false);
      state?.dismiss(id);
    },
    [state, count],
  );

  if (!state) return null;

  return (
    <div
      ref={region}
      data-toast-region=""
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={(event) => {
        if (!region.current?.contains(event.relatedTarget as Node | null)) {
          returnFocus.current = event.relatedTarget instanceof HTMLElement ? event.relatedTarget : null;
        }
        setFocused(true);
      }}
      onBlur={(event) => {
        if (!region.current?.contains(event.relatedTarget as Node | null)) setFocused(false);
      }}
      className="pointer-events-none absolute inset-x-toast-inset top-toast-inset z-10 grid justify-items-center"
    >
      {shown.map((toast, index) => (
        <Toast
          key={toast.id}
          toast={toast}
          depth={shown.length - 1 - index}
          paused={hovered || focused}
          onDismiss={dismiss}
        />
      ))}
    </div>
  );
}
