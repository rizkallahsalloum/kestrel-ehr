import { describe, expect, it } from "vitest";
import {
  dismissToast,
  EMPTY_TOAST_QUEUE,
  enqueueToast,
  TOAST_DEDUPE_MS,
  TOAST_MAX_VISIBLE,
  type ToastQueue,
} from "./toast-queue";

const messages = (items: { message: string }[]) => items.map((toast) => toast.message);

function addAll(list: string[], start = 0): ToastQueue {
  return list.reduce((queue, message, i) => enqueueToast(queue, message, start + i), EMPTY_TOAST_QUEUE);
}

describe("enqueueToast", () => {
  it("shows up to three and keeps the rest waiting in order", () => {
    const queue = addAll(["A", "B", "C", "D", "E"]);
    expect(TOAST_MAX_VISIBLE).toBe(3);
    expect(messages(queue.visible)).toEqual(["A", "B", "C"]);
    expect(messages(queue.waiting)).toEqual(["D", "E"]);
    expect(new Set([...queue.visible, ...queue.waiting].map((t) => t.id)).size).toBe(5);
  });

  it("drops a message that is already showing or waiting", () => {
    const queue = addAll(["A", "B", "C", "D"]);
    expect(enqueueToast(queue, "A", 10_000)).toBe(queue);
    expect(enqueueToast(queue, "D", 10_000)).toBe(queue);
  });

  it("drops a repeat within the duplicate window, even after the first was dismissed", () => {
    let queue = enqueueToast(EMPTY_TOAST_QUEUE, "Saved", 0);
    queue = dismissToast(queue, queue.visible[0]!.id);
    expect(enqueueToast(queue, "Saved", TOAST_DEDUPE_MS - 1)).toBe(queue);
    expect(messages(enqueueToast(queue, "Saved", TOAST_DEDUPE_MS).visible)).toEqual(["Saved"]);
  });

  it("forgets old messages so the duplicate record does not grow", () => {
    const queue = enqueueToast(addAll(["A", "B"]), "C", TOAST_DEDUPE_MS + 10);
    expect(Object.keys(queue.added)).toEqual(["C"]);
  });
});

describe("dismissToast", () => {
  it("promotes the oldest waiting toast into the free place", () => {
    const queue = addAll(["A", "B", "C", "D", "E"]);
    const next = dismissToast(queue, queue.visible[1]!.id);
    expect(messages(next.visible)).toEqual(["A", "C", "D"]);
    expect(messages(next.waiting)).toEqual(["E"]);
  });

  it("ignores an unknown id", () => {
    const queue = addAll(["A"]);
    expect(dismissToast(queue, 999)).toEqual(queue);
  });
});
