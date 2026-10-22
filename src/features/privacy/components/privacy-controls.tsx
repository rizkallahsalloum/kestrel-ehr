"use client"; // Reads Privacy mode state from the provider and handles clicks.

import { useLayoutEffect } from "react";
import { Button, EyeOffIcon } from "@/components/ui";
import { getPrivacyStore } from "../store";
import { usePrivacy } from "./privacy-provider";

/**
 * Top-bar toggle. Icon-only below `lg` (820px): from 761px the top bar is one row and the label
 * does not fit next to the search until 820px. The accessible name is always "Privacy".
 * The polite live region next to it announces global and per-field masking.
 */
export function PrivacyButton() {
  const { on, toggle, announcement } = usePrivacy();
  return (
    <>
      <Button
        variant="quiet"
        size="sm"
        aria-pressed={on}
        aria-keyshortcuts="Control+. Meta+."
        onClick={toggle}
        className="max-lg:px-2 aria-pressed:bg-surface-warm aria-pressed:text-ink"
      >
        <EyeOffIcon />
        <span className="max-lg:sr-only">Privacy</span>
      </Button>
      <p aria-live="polite" className="sr-only">
        {/* A new node per announcement, so the same text twice in a row is read again. */}
        <span key={announcement.id}>{announcement.text}</span>
      </p>
    </>
  );
}

/** Turns Privacy mode off on the sign-in page, so every sign-in starts with content shown. */
export function PrivacyReset() {
  useLayoutEffect(() => getPrivacyStore().clear(), []);
  return null;
}
