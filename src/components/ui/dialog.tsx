"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { cn } from "./cn";

/**
 * Modal dialog on the native `<dialog>` element: `showModal` makes the rest of the page inert and
 * handles Escape. Focus returns to the element that was focused on open. Tab order is the browser's
 * native modal behaviour, not a custom trap (docs/theme.md, Component behaviour).
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  className,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onClose={() => {
        onClose();
        returnFocus.current?.focus();
        returnFocus.current = null;
      }}
      className={cn(
        "m-auto w-dialog rounded-card border border-line bg-surface p-5 text-ink shadow-level-2 backdrop:bg-scrim open:animate-fade-up",
        className,
      )}
    >
      <h2 id={titleId} className="text-heading-sm font-semibold">
        {title}
      </h2>
      {description && (
        <p id={descriptionId} className="mt-1 text-body-sm text-ink-secondary">
          {description}
        </p>
      )}
      <div className="mt-4">{children}</div>
    </dialog>
  );
}
