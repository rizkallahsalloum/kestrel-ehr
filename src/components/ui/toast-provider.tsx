"use client"; // Holds the toast queue and timers in state and watches hover, focus and open dialogs.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { CheckCircleIcon, CloseIcon } from "./icons";
import { dismissToast, EMPTY_TOAST_QUEUE, enqueueToast, TOAST_DURATION_MS, type ToastItem } from "./toast-queue";

type Notify = (message: string) => void;

const ToastContext = createContext<Notify>(() => {});

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

function Toast({
  toast,
  paused,
  onDismiss,
}: {
  toast: ToastItem;
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
      onKeyDown={onKeyDown}
      className="pointer-events-auto flex w-full max-w-toast items-center gap-3 rounded-control bg-inverse py-xs pr-xs pl-sm text-label text-on-inverse shadow-level-2 motion-safe:animate-toast-in"
    >
      <CheckCircleIcon className="shrink-0 text-on-inverse" />
      <p className="min-w-0 flex-1">{toast.message}</p>
      <button
        type="button"
        onClick={(event) => onDismiss(toast.id, event.detail === 0)}
        aria-label="Dismiss notification"
        className="grid size-control-sm shrink-0 place-items-center rounded-control text-on-inverse hover:bg-inverse-raised focus-visible:outline-on-inverse"
      >
        <CloseIcon />
      </button>
    </div>
  );
}

/**
 * One polite live region, fixed over the top bar. Toasts auto-dismiss after six seconds, pause while
 * hovered or focused, close with their button or Escape, never take focus, and wait while a dialog
 * is open. Lives in the app layout so it survives the refresh after a Server Action.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [queue, setQueue] = useState(EMPTY_TOAST_QUEUE);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const dialogOpen = useDialogOpen();
  const region = useRef<HTMLDivElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);

  const notify = useCallback<Notify>((message) => setQueue((q) => enqueueToast(q, message, Date.now())), []);

  const dismiss = useCallback((id: number, viaKeyboard: boolean) => {
    if (viaKeyboard) {
      // The focused toast is about to go: move to the next toast, else back to where focus was before.
      const toasts = [...(region.current?.querySelectorAll<HTMLElement>("[data-toast] button") ?? [])];
      const next = toasts.find((button) => !button.closest("[data-toast]")?.contains(document.activeElement));
      const target = next ?? (returnFocus.current?.isConnected ? returnFocus.current : document.getElementById("main"));
      target?.focus();
    } else {
      // A removed element fires no blur or mouseleave, so the pause would otherwise stick.
      setFocused(false);
    }
    setHovered(false);
    setQueue((q) => dismissToast(q, id));
  }, []);

  const shown = dialogOpen ? [] : queue.visible;

  return (
    <ToastContext value={notify}>
      {children}
      <div
        ref={region}
        role="status"
        aria-live="polite"
        aria-atomic="false"
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
        className="pointer-events-none fixed top-toast-inset right-toast-inset left-toast-left z-30 flex flex-col items-center gap-toast-gap md:left-toast-left-wide"
      >
        {shown.map((toast) => (
          <Toast key={toast.id} toast={toast} paused={hovered || focused} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext>
  );
}
