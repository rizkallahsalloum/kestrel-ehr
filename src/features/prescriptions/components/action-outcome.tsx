"use client"; // Moves focus after a post-action refresh, which needs an effect and a ref.

import { useEffect, useRef } from "react";

/**
 * A polite live region that stays mounted while the page refreshes after an action, so a change
 * to `message` is announced. When the message changes (not on first render), focus moves to
 * `focusId`, a heading with `tabIndex={-1}`, because the control that ran the action is gone.
 */
export function ActionOutcome({ message, focusId, className }: { message: string; focusId: string; className?: string }) {
  const previous = useRef(message);

  useEffect(() => {
    if (previous.current === message) return;
    previous.current = message;
    document.getElementById(focusId)?.focus();
  }, [message, focusId]);

  return (
    <span role="status" className={className}>
      {message}
    </span>
  );
}
