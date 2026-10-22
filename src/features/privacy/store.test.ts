import { describe, expect, it, vi } from "vitest";
import {
  PRIVACY_ATTRIBUTE,
  PRIVACY_BOOT_SCRIPT,
  PRIVACY_IDLE_MS,
  PRIVACY_IDLE_OPTIONS,
  PRIVACY_IDLE_STORAGE_KEY,
  PRIVACY_STORAGE_KEY,
} from "./config";
import { createIdleSettingStore, createPrivacyStore } from "./store";

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
    data,
  };
}

function fakeRoot() {
  const attributes = new Map<string, string>();
  return {
    setAttribute: (name: string, value: string) => void attributes.set(name, value),
    removeAttribute: (name: string) => void attributes.delete(name),
    attributes,
  };
}

describe("privacy store", () => {
  it("starts off when nothing is stored, and on when the tab stored it", () => {
    expect(createPrivacyStore(memoryStorage(), null).get()).toBe(false);
    expect(createPrivacyStore(memoryStorage({ [PRIVACY_STORAGE_KEY]: "on" }), null).get()).toBe(true);
  });

  it("persists to storage and mirrors the root attribute", () => {
    const storage = memoryStorage();
    const root = fakeRoot();
    const store = createPrivacyStore(storage, root);
    const listener = vi.fn();
    store.subscribe(listener);

    store.set(true);
    expect(storage.data.get(PRIVACY_STORAGE_KEY)).toBe("on");
    expect(root.attributes.get(PRIVACY_ATTRIBUTE)).toBe("on");
    expect(listener).toHaveBeenCalledTimes(1);
    // A later page in the same tab reads the stored value.
    expect(createPrivacyStore(storage, null).get()).toBe(true);

    store.clear();
    expect(storage.data.has(PRIVACY_STORAGE_KEY)).toBe(false);
    expect(root.attributes.has(PRIVACY_ATTRIBUTE)).toBe(false);
    expect(store.get()).toBe(false);
  });

  it("forget drops the stored value but leaves the page masked until the sign-in page clears it", () => {
    const storage = memoryStorage();
    const root = fakeRoot();
    const store = createPrivacyStore(storage, root);
    store.set(true);
    store.forget();
    expect(storage.data.has(PRIVACY_STORAGE_KEY)).toBe(false);
    expect(root.attributes.get(PRIVACY_ATTRIBUTE)).toBe("on");
  });

  it("still works in memory when storage throws", () => {
    const broken = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
      removeItem: () => {
        throw new Error("blocked");
      },
    };
    const root = fakeRoot();
    const store = createPrivacyStore(broken, root);
    expect(store.get()).toBe(false);
    store.set(true);
    expect(store.get()).toBe(true);
    expect(root.attributes.get(PRIVACY_ATTRIBUTE)).toBe("on");
  });

  it("re-applies the attribute after it was removed by someone else", () => {
    const root = fakeRoot();
    const store = createPrivacyStore(memoryStorage({ [PRIVACY_STORAGE_KEY]: "on" }), root);
    store.applyAttribute();
    expect(root.attributes.get(PRIVACY_ATTRIBUTE)).toBe("on");
  });

  it("boot script reads the same key and sets the same attribute", () => {
    expect(PRIVACY_BOOT_SCRIPT).toContain(JSON.stringify(PRIVACY_STORAGE_KEY));
    expect(PRIVACY_BOOT_SCRIPT).toContain(JSON.stringify(PRIVACY_ATTRIBUTE));
    expect(PRIVACY_BOOT_SCRIPT).toContain("sessionStorage");
  });
});

describe("privacy auto-hide setting", () => {
  it("offers 30 seconds, 1 minute and 2 minutes, defaulting to 1 minute", () => {
    expect(PRIVACY_IDLE_OPTIONS.map((o) => [o.ms, o.label])).toEqual([
      [30_000, "30 seconds"],
      [60_000, "1 minute"],
      [120_000, "2 minutes"],
    ]);
    expect(PRIVACY_IDLE_MS).toBe(60_000);
    expect(createIdleSettingStore(memoryStorage()).get()).toBe(60_000);
  });

  it("stores a choice in sessionStorage and notifies subscribers", () => {
    const storage = memoryStorage();
    const store = createIdleSettingStore(storage);
    const listener = vi.fn();
    store.subscribe(listener);
    store.set(30_000);
    expect(storage.data.get(PRIVACY_IDLE_STORAGE_KEY)).toBe("30000");
    expect(store.get()).toBe(30_000);
    expect(listener).toHaveBeenCalledTimes(1);
    store.clear();
    expect(storage.data.has(PRIVACY_IDLE_STORAGE_KEY)).toBe(false);
    expect(store.get()).toBe(60_000);
  });

  it("ignores values that are not offered, stored or set", () => {
    expect(createIdleSettingStore(memoryStorage({ [PRIVACY_IDLE_STORAGE_KEY]: "1000" })).get()).toBe(60_000);
    expect(createIdleSettingStore(memoryStorage({ [PRIVACY_IDLE_STORAGE_KEY]: "abc" })).get()).toBe(60_000);
    const store = createIdleSettingStore(memoryStorage());
    store.set(5);
    expect(store.get()).toBe(60_000);
  });

  it("keeps the choice in memory when storage is unavailable", () => {
    const store = createIdleSettingStore(null);
    store.set(120_000);
    expect(store.get()).toBe(120_000);
  });
});