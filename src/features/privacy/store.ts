import {
  PRIVACY_ATTRIBUTE,
  PRIVACY_IDLE_MS,
  PRIVACY_IDLE_OPTIONS,
  PRIVACY_IDLE_STORAGE_KEY,
  PRIVACY_STORAGE_KEY,
} from "./config";

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

export type IdleSettingStore = {
  get: () => number;
  set: (ms: number) => void;
  clear: () => void;
  subscribe: (listener: () => void) => () => void;
};

function isIdleOption(ms: number): boolean {
  return PRIVACY_IDLE_OPTIONS.some((option) => option.ms === ms);
}

/** The "Privacy auto-hide" choice: one of `PRIVACY_IDLE_OPTIONS`, `PRIVACY_IDLE_MS` when unset or invalid. */
export function createIdleSettingStore(storage: StorageLike | null): IdleSettingStore {
  // Used only when storage is unavailable; otherwise storage is read each time, so a value written
  // elsewhere in the tab (another store instance, a test) is picked up.
  let memory: number | null = null;
  const listeners = new Set<() => void>();

  const read = (): number => {
    let stored = memory ?? Number.NaN;
    try {
      if (storage) stored = Number(storage.getItem(PRIVACY_IDLE_STORAGE_KEY));
    } catch {
      // Falls back to the in-memory value.
    }
    return isIdleOption(stored) ? stored : PRIVACY_IDLE_MS;
  };

  const write = (ms: number | null) => {
    memory = ms;
    try {
      if (ms === null) storage?.removeItem(PRIVACY_IDLE_STORAGE_KEY);
      else storage?.setItem(PRIVACY_IDLE_STORAGE_KEY, String(ms));
    } catch {
      // The in-memory value still applies to this page.
    }
    listeners.forEach((listener) => listener());
  };

  return {
    get: read,
    set: (ms) => {
      if (isIdleOption(ms)) write(ms);
    },
    clear: () => write(null),
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

function sessionStorageOrNull(): StorageLike | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

let browserIdleStore: IdleSettingStore | null = null;

/** The auto-hide setting for this browser tab. Only call it in the browser. */
export function getIdleSettingStore(): IdleSettingStore {
  browserIdleStore ??= createIdleSettingStore(sessionStorageOrNull());
  return browserIdleStore;
}

let browserStore: PrivacyStore | null = null;

/** The store for this browser tab. Only call it in the browser. */
export function getPrivacyStore(): PrivacyStore {
  browserStore ??= createPrivacyStore(sessionStorageOrNull(), document.documentElement);
  return browserStore;
}
