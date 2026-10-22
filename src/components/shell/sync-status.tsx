"use client"; // navigator.onLine, the online/offline events and the minute clock only exist in the browser.

import { usePathname } from "next/navigation";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { StatusDot } from "@/components/ui";
import { usePrivacy } from "@/features/privacy/components/privacy-provider";
import { formatRelativeTime } from "@/lib/relative-time";

function subscribeOnline(listener: () => void) {
  window.addEventListener("online", listener);
  window.addEventListener("offline", listener);
  return () => {
    window.removeEventListener("online", listener);
    window.removeEventListener("offline", listener);
  };
}

// One shared minute clock; the snapshot only changes on a tick, so renders stay stable in between.
let clockNow = 0;
function subscribeClock(listener: () => void) {
  clockNow = Date.now();
  const id = window.setInterval(() => {
    clockNow = Date.now();
    listener();
  }, 60_000);
  return () => window.clearInterval(id);
}

// Time of the last client navigation: each one renders fresh server data for the new page.
let syncedAt = 0;
const syncListeners = new Set<() => void>();
function subscribeSynced(listener: () => void) {
  syncListeners.add(listener);
  return () => syncListeners.delete(listener);
}
function markSynced(at: number) {
  syncedAt = at;
  clockNow = Math.max(clockNow, at);
  syncListeners.forEach((listener) => listener());
}

/**
 * Top-bar sync line (dashboard `.sync-pill`). "Last synced" is the server render time, then the time
 * of each client navigation; the connection comes from `navigator.onLine`. The relative time updates
 * every minute silently; only going offline or back online is announced, through the polite live
 * region next to the Privacy button. Offline is red and also says "Offline", not colour alone.
 */
export function SyncStatus({ renderedAt, className }: { renderedAt: string; className?: string }) {
  const renderedMs = Date.parse(renderedAt);
  const pathname = usePathname();
  const { announce } = usePrivacy();
  const online = useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);
  const now = useSyncExternalStore(subscribeClock, () => clockNow || renderedMs, () => renderedMs);
  const lastSync = useSyncExternalStore(subscribeSynced, () => syncedAt || renderedMs, () => renderedMs);

  const firstPath = useRef(true);
  useEffect(() => {
    if (firstPath.current) {
      firstPath.current = false;
      return;
    }
    markSynced(Date.now());
  }, [pathname]);

  const previousOnline = useRef(online);
  useEffect(() => {
    if (previousOnline.current === online) return;
    previousOnline.current = online;
    announce(online ? "Back online" : "Offline, changes are not syncing");
  }, [online, announce]);

  const ago = formatRelativeTime(lastSync, Math.max(now, lastSync));
  return (
    <p
      data-testid="sync-status"
      data-online={online}
      className={
        className ??
        "hidden shrink-0 items-center gap-2 border-l border-line-subtle pl-4.5 text-caption whitespace-nowrap text-ink-muted xl:flex"
      }
    >
      <StatusDot tone={online ? "stable" : "critical"} />
      {online ? (
        <span>Synced with Kestrel Health Network · {ago}</span>
      ) : (
        <span>
          <span className="font-semibold text-danger">Offline</span> · last synced {ago}
        </span>
      )}
    </p>
  );
}
