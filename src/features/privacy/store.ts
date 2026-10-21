import { PRIVACY_ATTRIBUTE, PRIVACY_STORAGE_KEY } from "./config";

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;
type RootLike = Pick<Element, "setAttribute" | "removeAttribute">;

export type PrivacyStore = {
  get: () => boolean;
  set: (on: boolean) => void;
  clear: () => void;
  /**
   * Drops the stored value but keeps the page masked: used on sign-out, so the content does not
   * reappear while the browser leaves for the sign-in page (which calls `clear`).
   */
  forget: () => void;
  /** Writes the current state to the root attribute again (React's dev remount clears it). */
  applyAttribute: () => void;
  subscribe: (listener: () => void) => () => void;
};

/**
 * Privacy state: sessionStorage when available, an in-memory value otherwise, mirrored to an
 * attribute on <html> synchronously so the masking CSS applies in the same frame.
 */
export function createPrivacyStore(storage: StorageLike | null, root: RootLike | null): PrivacyStore {
  let current: boolean | null = null;
  const listeners = new Set<() => void>();

  const read = (): boolean => {
    if (current !== null) return current;
    try {
      current = storage?.getItem(PRIVACY_STORAGE_KEY) === "on";
    } catch {
      current = false;
    }
    return current;
  };

  const applyAttribute = () => {
    if (read()) root?.setAttribute(PRIVACY_ATTRIBUTE, "on");
    else root?.removeAttribute(PRIVACY_ATTRIBUTE);
  };

  const set = (on: boolean) => {
    current = on;
    try {
      if (on) storage?.setItem(PRIVACY_STORAGE_KEY, "on");
      else storage?.removeItem(PRIVACY_STORAGE_KEY);
    } catch {
      // Storage can be unavailable (blocked or full); the in-memory value still applies to this page.
    }
    applyAttribute();
    listeners.forEach((listener) => listener());
  };

  return {
    get: read,
    set,
    clear: () => set(false),
    forget: () => {
      try {
        storage?.removeItem(PRIVACY_STORAGE_KEY);
      } catch {
        // Nothing stored.
      }
    },
    applyAttribute,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

let browserStore: PrivacyStore | null = null;

/** The store for this browser tab. Only call it in the browser. */
export function getPrivacyStore(): PrivacyStore {
  if (!browserStore) {
    let storage: StorageLike | null = null;
    try {
      storage = window.sessionStorage;
    } catch {
      storage = null;
    }
    browserStore = createPrivacyStore(storage, document.documentElement);
  }
  return browserStore;
}
