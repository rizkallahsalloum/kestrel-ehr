export type IdleTimer = {
  start: () => void;
  stop: () => void;
  /** Records activity. Cheap enough to call on every pointer move. */
  activity: () => void;
  /** Fires now if the full idle period has passed, for example when a background tab returns. */
  check: () => void;
};

/**
 * Calls `onIdle` once after `idleMs` without activity. Activity only records a timestamp; the
 * single pending timeout re-arms itself for the remaining time, so frequent events cost nothing.
 */
export function createIdleTimer({
  idleMs,
  onIdle,
  now = () => Date.now(),
}: {
  idleMs: number;
  onIdle: () => void;
  now?: () => number;
}): IdleTimer {
  let last = 0;
  let handle: ReturnType<typeof setTimeout> | null = null;
  let running = false;

  const clear = () => {
    if (handle !== null) clearTimeout(handle);
    handle = null;
  };

  const check = () => {
    if (!running) return;
    const remaining = idleMs - (now() - last);
    if (remaining <= 0) {
      running = false;
      clear();
      onIdle();
      return;
    }
    clear();
    handle = setTimeout(check, remaining);
  };

  return {
    start: () => {
      running = true;
      last = now();
      clear();
      handle = setTimeout(check, idleMs);
    },
    stop: () => {
      running = false;
      clear();
    },
    activity: () => {
      last = now();
    },
    check,
  };
}
