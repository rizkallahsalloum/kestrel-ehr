"use client"; // Swaps patient values for a mask from Privacy mode state, with per-field reveal and its timer.

import {
  cloneElement,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactElement,
  type RefObject,
} from "react";
import { cn } from "./cn";

/** Fixed mask: its width never depends on the value it hides. */
export const PRIVACY_MASK = "••••••";

export type PrivacyMaskState = {
  masked: boolean;
  /** Increases each time masking is applied again; a field revealed in an earlier epoch is masked. */
  epoch: number;
  /** How long a field revealed on its own stays visible. */
  revealMs: number;
  /** Polite announcement through the Privacy live region. */
  announce: (message: string) => void;
  /** Counts revealed fields, so a global re-mask announces only when something changes. */
  trackReveal: (delta: 1 | -1) => void;
};

/**
 * Privacy mode state for `PrivateText` and `PrivateField`. Provided by the Privacy feature; without
 * a provider nothing is masked.
 */
export const PrivacyMaskContext = createContext<PrivacyMaskState>({
  masked: false,
  epoch: 0,
  revealMs: 0,
  announce: () => {},
  trackReveal: () => {},
});

/** Focus target inside a `[data-private]` wrapper after the value and the mask swap. */
export const PRIVATE_FOCUS_SELECTOR = "[data-private-focus], input, select, textarea";

/** Dispatched on `window` right before masking is applied, so shown values record their box first. */
export const PRIVACY_MEASURE_EVENT = "kestrel:privacy-measure";

function useReveal(
  label: string,
  paused: boolean,
  wrapRef: RefObject<HTMLElement | null>,
  beforeMask?: () => void,
) {
  const { masked, epoch, revealMs, announce, trackReveal } = useContext(PrivacyMaskContext);
  const [revealedIn, setRevealedIn] = useState<number | null>(null);
  const revealed = masked && revealedIn === epoch;
  const pendingFocus = useRef(false);

  useEffect(() => {
    if (!revealed) return;
    trackReveal(1);
    return () => trackReveal(-1);
  }, [revealed, trackReveal]);

  useEffect(() => {
    if (!revealed || paused) return;
    const timer = setTimeout(() => {
      beforeMask?.();
      pendingFocus.current = Boolean(wrapRef.current?.contains(document.activeElement));
      setRevealedIn(null);
      announce(`${label} hidden`);
    }, revealMs);
    return () => clearTimeout(timer);
  }, [revealed, paused, revealMs, label, announce, wrapRef, beforeMask]);

  // Keeps keyboard focus on the field when its value and mask swap.
  useLayoutEffect(() => {
    if (!pendingFocus.current) return;
    pendingFocus.current = false;
    wrapRef.current?.querySelector<HTMLElement>(PRIVATE_FOCUS_SELECTOR)?.focus();
  });

  const reveal = useCallback(() => {
    pendingFocus.current = true;
    setRevealedIn(epoch);
    announce(`${label} shown`);
  }, [epoch, label, announce]);

  return { hidden: masked && !revealed, revealed, reveal };
}

/**
 * Patient value that Privacy mode replaces with a fixed mask. While masked the value is not in the
 * DOM text or the accessibility tree; a button named "<label> hidden, press to reveal" shows it for
 * the configured time. The mask takes the box the value last had, so toggling does not move
 * anything (a value first rendered masked has no box yet and uses the mask's own width).
 * `revealable={false}` renders a plain mask, for values inside links or decorative elements.
 */
export function PrivateText({
  label,
  children,
  block = false,
  revealable = true,
  mask = PRIVACY_MASK,
  className,
}: {
  /** Field name, used in the accessible name and announcements. */
  label: string;
  children: string | number | null | undefined;
  /** Block-level value (may wrap over several lines); the mask keeps the value's height. */
  block?: boolean;
  revealable?: boolean;
  mask?: string;
  className?: string;
}) {
  const value = children == null ? "" : String(children);
  const wrapRef = useRef<HTMLSpanElement>(null);
  const maskRef = useRef<HTMLElement>(null);
  const box = useRef<{ width: number; height: number } | null>(null);

  // Records the shown value's box (a measured size, not a design value). Values that are not laid
  // out (closed dialog, hidden column) keep their last box.
  const measure = useCallback(() => {
    const wrap = wrapRef.current;
    if (!wrap?.querySelector("[data-private-value]")) return;
    const rect = wrap.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) box.current = { width: rect.width, height: rect.height };
  }, []);
  const { hidden, revealed, reveal } = useReveal(label, false, wrapRef, measure);

  // The mask takes the recorded box before paint, so swapping causes no layout shift.
  useLayoutEffect(() => {
    if (!hidden) {
      measure();
      window.addEventListener(PRIVACY_MEASURE_EVENT, measure);
      return () => window.removeEventListener(PRIVACY_MEASURE_EVENT, measure);
    }
    const mask = maskRef.current;
    if (mask && box.current) {
      if (block) mask.style.minHeight = `${box.current.height}px`;
      else mask.style.width = `${box.current.width}px`;
    }
  }, [hidden, value, block, measure]);

  if (!value) return null;

  const maskClass = cn(
    "overflow-clip text-left whitespace-nowrap select-none",
    block ? "block w-full" : "inline-block max-w-full",
  );

  return (
    <span ref={wrapRef} data-private="" className={cn(block && "block", className)}>
      {hidden ? (
        revealable ? (
          <button
            ref={(node) => {
              maskRef.current = node;
            }}
            type="button"
            data-private-focus=""
            aria-label={`${label} hidden, press to reveal`}
            onClick={reveal}
            className={cn(maskClass, "cursor-pointer")}
          >
            {mask}
          </button>
        ) : (
          <span
            ref={(node) => {
              maskRef.current = node;
            }}
            role="img"
            aria-label={`${label} hidden`}
            className={maskClass}
          >
            {mask}
          </span>
        )
      ) : (
        <span
          data-private-value=""
          data-revealed={revealed || undefined}
          data-private-focus={revealable ? "" : undefined}
          tabIndex={revealable ? -1 : undefined}
          className={cn(block && "block", "outline-offset-2")}
        >
          {value}
        </span>
      )}
    </span>
  );
}

type FieldChildProps = {
  id?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean | "true" | "false";
  "aria-required"?: boolean | "true" | "false";
};

/**
 * Form control that Privacy mode masks in place. The control stays mounted (hidden, inert and out of
 * the accessibility tree) so its box, unsaved value and form submission are unchanged; a mask button
 * covers it. A revealed control stays visible while focus is inside it and is masked again the
 * configured time after focus leaves. Inside `FormField`, the wiring props pass through to the control,
 * which therefore has to be created in a client component: a Server Component's child arrives already
 * rendered, and the props would land on its outer element.
 */
export function PrivateField({
  label,
  children,
  className,
  ...fieldProps
}: { label: string; children: ReactElement<FieldChildProps>; className?: string } & FieldChildProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [focusWithin, setFocusWithin] = useState(false);
  const { hidden, revealed, reveal } = useReveal(label, focusWithin, wrapRef);
  const control = Object.keys(fieldProps).length > 0 ? cloneElement(children, fieldProps) : children;

  return (
    <div
      ref={wrapRef}
      data-private=""
      className={cn("relative", className)}
      onFocus={() => setFocusWithin(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocusWithin(false);
      }}
    >
      {hidden && (
        <button
          type="button"
          data-private-focus=""
          aria-label={`${label} hidden, press to reveal`}
          onClick={reveal}
          className="absolute inset-0 flex cursor-pointer items-center overflow-clip rounded-control border-(length:--border-width-field) border-line-field bg-surface-warm px-sm text-left font-medium whitespace-nowrap text-ink-strong select-none"
        >
          {PRIVACY_MASK}
        </button>
      )}
      <div
        data-private-value=""
        data-revealed={revealed || undefined}
        inert={hidden}
        aria-hidden={hidden || undefined}
        className={cn(hidden && "invisible select-none")}
      >
        {control}
      </div>
    </div>
  );
}
