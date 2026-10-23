import { isPublicRef } from "@/features/patients/refs";

/** sessionStorage key for the reference of the last chart opened in this tab (an opaque ref only, no patient content). */
const STORAGE_KEY = "kestrel.lastPatient";

const CHART_PATH = /^\/patients\/([^/?#]+)(?:\/|$)/;

/** The patient reference in a chart or prescription URL, if any. */
export function patientRefFromPath(pathname: string): string | null {
  const segment = CHART_PATH.exec(pathname)?.[1];
  return segment && isPublicRef(segment) ? segment : null;
}

const listeners = new Set<() => void>();

function storage(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export const lastPatientStore = {
  get(): string | null {
    try {
      return storage()?.getItem(STORAGE_KEY) ?? null;
    } catch {
      return null;
    }
  },
  set(ref: string | null) {
    try {
      if (ref) storage()?.setItem(STORAGE_KEY, ref);
      else storage()?.removeItem(STORAGE_KEY);
    } catch {
      // Unavailable storage: the rail falls back to the first queue patient.
    }
    listeners.forEach((listener) => listener());
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};
