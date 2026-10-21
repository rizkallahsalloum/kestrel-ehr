"use client"; // Reads Privacy mode state from the provider and handles clicks.

import { useLayoutEffect, type ReactNode } from "react";
import { Button, Card, EyeOffIcon } from "@/components/ui";
import { getPrivacyStore } from "../store";
import { usePrivacy } from "./privacy-provider";

/**
 * Top-bar toggle. Icon-only below `lg` (820px): from 761px the top bar is one row and the label
 * does not fit next to the search until 820px. The accessible name is always "Privacy".
 */
export function PrivacyButton() {
  const { on, toggle, message, privacyButtonRef } = usePrivacy();
  return (
    <>
      <Button
        ref={privacyButtonRef}
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
        {message}
      </p>
    </>
  );
}

/**
 * The one masking rule: everything in the content area (pages, loading skeletons, dialogs opened
 * from them). Hidden with `visibility`, so layout and unsaved form state are unchanged, and made
 * inert and hidden from assistive technology while Privacy mode is on.
 */
export function PrivacyContent({ children }: { children: ReactNode }) {
  const { on } = usePrivacy();
  return (
    <div data-privacy-content="" inert={on} aria-hidden={on || undefined}>
      {children}
    </div>
  );
}

/** Scrim over the content area with the "Show content" card. Display is driven by the CSS rule. */
export function PrivacyOverlay() {
  const { show, showButtonRef } = usePrivacy();
  return (
    <section
      data-privacy-overlay=""
      aria-labelledby="privacy-overlay-title"
      className="absolute inset-0 z-10 flex justify-center bg-scrim px-4 py-6 md:px-7"
    >
      <div className="sticky top-1/3 h-fit w-dialog motion-safe:animate-fade-up">
        <Card elevated className="flex flex-col items-center gap-3 text-center">
          <EyeOffIcon className="size-6 text-ink-secondary" />
          <h2 id="privacy-overlay-title" className="text-heading-sm font-semibold text-ink">
            Content hidden
          </h2>
          <p className="text-body-sm text-ink-secondary">
            Patient information on this screen is hidden. Ctrl+. (Cmd+. on a Mac) also shows it.
          </p>
          <Button ref={showButtonRef} onClick={show}>
            Show content
          </Button>
        </Card>
      </div>
    </section>
  );
}

/** Turns Privacy mode off on the sign-in page, so every sign-in starts with content shown. */
export function PrivacyReset() {
  useLayoutEffect(() => getPrivacyStore().clear(), []);
  return null;
}
