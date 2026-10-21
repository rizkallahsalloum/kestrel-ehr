import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PRIVACY_IDLE_MS } from "./config";
import { createIdleTimer } from "./idle-timer";

describe("createIdleTimer", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("defaults to 60 seconds", () => {
    expect(PRIVACY_IDLE_MS).toBe(60_000);
  });

  it("fires once after the idle period without activity", () => {
    const onIdle = vi.fn();
    createIdleTimer({ idleMs: 60_000, onIdle }).start();
    vi.advanceTimersByTime(59_999);
    expect(onIdle).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onIdle).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(600_000);
    expect(onIdle).toHaveBeenCalledTimes(1);
  });

  it("restarts the full period on activity", () => {
    const onIdle = vi.fn();
    const timer = createIdleTimer({ idleMs: 60_000, onIdle });
    timer.start();
    vi.advanceTimersByTime(45_000);
    timer.activity();
    vi.advanceTimersByTime(45_000);
    expect(onIdle).not.toHaveBeenCalled();
    vi.advanceTimersByTime(15_000);
    expect(onIdle).toHaveBeenCalledTimes(1);
  });

  it("works with a 30-second setting", () => {
    const onIdle = vi.fn();
    createIdleTimer({ idleMs: 30_000, onIdle }).start();
    vi.advanceTimersByTime(30_000);
    expect(onIdle).toHaveBeenCalledTimes(1);
  });

  it("keeps the content shown while typing continues, then fires a full period after the last keystroke", () => {
    const onIdle = vi.fn();
    const timer = createIdleTimer({ idleMs: 60_000, onIdle });
    timer.start();
    // A keystroke every 20 seconds for two minutes.
    for (let i = 0; i < 6; i++) {
      vi.advanceTimersByTime(20_000);
      timer.activity();
    }
    expect(onIdle).not.toHaveBeenCalled();
    vi.advanceTimersByTime(59_000);
    expect(onIdle).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1_000);
    expect(onIdle).toHaveBeenCalledTimes(1);
  });

  it("stop cancels, and check fires at once when the period has already passed", () => {
    const onIdle = vi.fn();
    let clock = 0;
    const timer = createIdleTimer({ idleMs: 60_000, onIdle, now: () => clock });
    timer.start();
    timer.stop();
    vi.advanceTimersByTime(120_000);
    expect(onIdle).not.toHaveBeenCalled();

    timer.start();
    clock = 90_000; // a background tab whose timeout was throttled
    timer.check();
    expect(onIdle).toHaveBeenCalledTimes(1);
  });
});
