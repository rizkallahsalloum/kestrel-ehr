"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/** Throws once hydrated, so the error starts in the browser and has no server digest. */
export function ThrowInBrowser({ message }: { message: string }) {
  const hydrated = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  if (hydrated) throw new Error(message);
  return <p>Loading error specimen…</p>;
}
