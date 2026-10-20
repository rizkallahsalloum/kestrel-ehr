import { cn } from "./cn";

const tones = {
  teal: "bg-avatar-teal text-on-accent",
  green: "bg-avatar-green text-on-accent",
  ink: "bg-ink text-page",
} as const;
const sizes = {
  sm: "size-7.5 text-caption",
  md: "size-13 text-heading-sm",
  lg: "size-14 text-heading-md",
} as const;

export type AvatarTone = keyof typeof tones;

export function initialsOf(givenName: string, familyName: string): string {
  return `${givenName.trim().charAt(0)}${familyName.trim().charAt(0)}`.toUpperCase();
}

/** Initials in mono. Decorative unless `label` is given; the name should be visible next to it. */
export function Avatar({
  initials,
  tone = "teal",
  size = "md",
  label,
  className,
}: {
  initials: string;
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
