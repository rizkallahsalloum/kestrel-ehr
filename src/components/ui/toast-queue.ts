// Pure queue logic for the toast provider: at most three on screen, the rest wait in order, and
// the same message is dropped while it is showing or waiting, or if it was added in the last few seconds.

export const TOAST_MAX_VISIBLE = 3;
/** Auto-dismiss delay; WCAG 2.2.1 asks for enough time, and the timer pauses on hover and focus. */
export const TOAST_DURATION_MS = 6000;
export const TOAST_DEDUPE_MS = 4000;

export type ToastItem = { id: number; message: string };

export type ToastQueue = {
  visible: ToastItem[];
  waiting: ToastItem[];
  /** When each message was last added, for the duplicate window. */
  added: Record<string, number>;
  nextId: number;
};

export const EMPTY_TOAST_QUEUE: ToastQueue = { visible: [], waiting: [], added: {}, nextId: 1 };

export function enqueueToast(queue: ToastQueue, message: string, now: number): ToastQueue {
  const pending = [...queue.visible, ...queue.waiting].some((toast) => toast.message === message);
  const last = queue.added[message];
  if (pending || (last !== undefined && now - last < TOAST_DEDUPE_MS)) return queue;

  const added = Object.fromEntries(Object.entries(queue.added).filter(([, at]) => now - at < TOAST_DEDUPE_MS));
  added[message] = now;
  const toast = { id: queue.nextId, message };
  const fits = queue.visible.length < TOAST_MAX_VISIBLE;
  return {
    visible: fits ? [...queue.visible, toast] : queue.visible,
    waiting: fits ? queue.waiting : [...queue.waiting, toast],
    added,
    nextId: queue.nextId + 1,
  };
}

/** Removes a toast; waiting toasts move up into the free places, oldest first. */
export function dismissToast(queue: ToastQueue, id: number): ToastQueue {
  const visible = queue.visible.filter((toast) => toast.id !== id);
  const waiting = queue.waiting.filter((toast) => toast.id !== id);
  const promoted = waiting.slice(0, TOAST_MAX_VISIBLE - visible.length);
  return { ...queue, visible: [...visible, ...promoted], waiting: waiting.slice(promoted.length) };
}
