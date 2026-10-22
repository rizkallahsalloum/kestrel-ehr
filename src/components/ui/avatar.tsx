import type { ReactNode } from "react";
import { cn } from "./cn";

const tones = {
  teal: "bg-avatar-teal text-on-accent",
  green: "bg-avatar-green text-on-accent",
  ink: "bg-ink text-page",
  // Today's queue palette slots (--color-queue-avatar-*); decorative, no meaning.
  "queue-1": "bg-queue-avatar-1 text-on-accent",
  "queue-2": "bg-queue-avatar-2 text-on-accent",
  "queue-3": "bg-queue-avatar-3 text-on-accent",
} as const;
const sizes = {
  xs: "size-5.5 text-caption",
  sm: "size-7.5 text-caption",
  md: "size-13 text-heading-sm",
  lg: "size-14 text-heading-md",
} as const;

export type AvatarTone = keyof typeof tones;

/** Initials (from `getInitials` in `src/lib/initials.ts`) in mono. Decorative unless `label` is given; the name should be visible next to it. */
export function Avatar({
  initials,
  tone = "teal",
  size = "md",
  label,
  className,
}: {
  /** Text, or a `PrivateText` for a patient's initials. */
  initials: ReactNode;
  tone?: AvatarTone;
  size?: keyof typeof sizes;
  label?: string;
  className?: string;
}) {
  return (
    <span
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn(
        "grid shrink-0 place-items-center rounded-full font-mono font-medium",
        tones[tone],
        sizes[size],
        className,
      )}
    >
      {initials}
    </span>
  );
}
