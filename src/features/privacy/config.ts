/**
 * Privacy mode hides patient content after this much inactivity (pointer, key, touch, scroll).
 * Change this one value to adjust it, for example to 30_000 for 30 seconds.
 */
export const PRIVACY_IDLE_MS = 60_000;

/** sessionStorage key: per tab, cleared when the tab closes, never sent to the server. */
export const PRIVACY_STORAGE_KEY = "kestrel.privacy";

/** Attribute on <html> that the CSS masking rule reads (globals.css, "Privacy mode"). */
export const PRIVACY_ATTRIBUTE = "data-privacy";

/**
 * Runs in <head> before the first paint, so a reload or a new page load with Privacy mode on never
 * shows patient content before React hydrates.
 */
export const PRIVACY_BOOT_SCRIPT = `(function(){try{if(sessionStorage.getItem(${JSON.stringify(PRIVACY_STORAGE_KEY)})==="on")document.documentElement.setAttribute(${JSON.stringify(PRIVACY_ATTRIBUTE)},"on")}catch(e){}})()`;
