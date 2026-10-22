/** sessionStorage key for the id of the last chart opened in this tab (an id only, no patient content). */
const STORAGE_KEY = "kestrel.lastPatient";

const CHART_PATH = /^\/patients\/([0-9a-f-]{36})(?:\/|$)/i;

/** The patient id in a chart or prescription URL, if any. */
export function patientIdFromPath(pathname: string): string | null {
  return CHART_PATH.exec(pathname)?.[1] ?? null;
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
  set(id: string | null) {
    try {
      if (id) storage()?.setItem(STORAGE_KEY, id);
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
