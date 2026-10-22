/**
 * Privacy mode hides patient content after this much inactivity (pointer, key, touch, scroll).
 * The user picks one of `PRIVACY_IDLE_OPTIONS` in the user menu ("Privacy auto-hide"); this is the default.
 */
export const PRIVACY_IDLE_MS = 60_000;

/** Choices in the user menu, in display order. */
export const PRIVACY_IDLE_OPTIONS = [
  { ms: 30_000, label: "30 seconds" },
  { ms: 60_000, label: "1 minute" },
  { ms: 120_000, label: "2 minutes" },
] as const;

/** sessionStorage key for the chosen auto-hide delay, in milliseconds. */
export const PRIVACY_IDLE_STORAGE_KEY = "kestrel.privacy.idle";

/** A field revealed on its own while Privacy mode is on is masked again after this long. */
export const PRIVACY_FIELD_REVEAL_MS = 10_000;

/** sessionStorage key: per tab, cleared when the tab closes, never sent to the server. */
export const PRIVACY_STORAGE_KEY = "kestrel.privacy";

/** Attribute on <html> that the pre-hydration CSS rule reads (globals.css, "Privacy mode"). */
export const PRIVACY_ATTRIBUTE = "data-privacy";

/**
 * Runs in <head> before the first paint, so a reload or a new page load with Privacy mode on never
 * shows patient content before React hydrates.
 */
export const PRIVACY_BOOT_SCRIPT = `(function(){try{if(sessionStorage.getItem(${JSON.stringify(PRIVACY_STORAGE_KEY)})==="on")document.documentElement.setAttribute(${JSON.stringify(PRIVACY_ATTRIBUTE)},"on")}catch(e){}})()`;
