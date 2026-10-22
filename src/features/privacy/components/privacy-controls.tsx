"use client"; // Reads Privacy mode state from the provider and handles clicks.

import { useLayoutEffect } from "react";
import { cn, EyeIcon, EyeOffIcon } from "@/components/ui";
import { getIdleSettingStore, getPrivacyStore } from "../store";
import { usePrivacy } from "./privacy-provider";

const LABELS = { off: "Privacy", on: "Privacy on" } as const;

/**
 * Top-bar ghost button, between the sync status and the account menu. Off: eye icon and "Privacy" in
 * the secondary text colour. On: eye-off icon and "Privacy on" in the success colour. No fill or
 * border at rest; a warm fill on hover only. Both labels share one grid cell, so the button keeps the
 * width of the longer one and nothing moves on toggle. Icon-only below `lg` (820px). The polite live
 * region next to it announces global and per-field masking.
 */
export function PrivacyButton() {
  const { on, toggle, announcement } = usePrivacy();
  const Icon = on ? EyeOffIcon : EyeIcon;
  return (
    <>
      <button
        type="button"
        aria-pressed={on}
        aria-keyshortcuts="Control+. Meta+."
        onClick={toggle}
        data-testid="privacy-toggle"
        className={cn(
          "inline-flex min-h-control-sm shrink-0 items-center gap-1.5 rounded-control px-2.5 text-button-sm font-medium whitespace-nowrap transition-colors duration-150 hover:bg-surface-warm max-lg:px-2",
          on ? "text-ok" : "text-ink-secondary",
        )}
      >
        <Icon />
        <span className="grid max-lg:sr-only">
          {(["off", "on"] as const).map((state) => {
            const current = (state === "on") === on;
            return (
              <span
                key={state}
                aria-hidden={current ? undefined : true}
                className={cn("col-start-1 row-start-1", !current && "invisible")}
              >
                {LABELS[state]}
              </span>
            );
          })}
        </span>
      </button>
      <p aria-live="polite" className="sr-only">
        {/* A new node per announcement, so the same text twice in a row is read again. */}
        <span key={announcement.id}>{announcement.text}</span>
      </p>
    </>
  );
}

/** Turns Privacy mode off on the sign-in page, so every sign-in starts with content shown and the default auto-hide delay. */
export function PrivacyReset() {
  useLayoutEffect(() => {
    getPrivacyStore().clear();
    getIdleSettingStore().clear();
  }, []);
  return null;
}
