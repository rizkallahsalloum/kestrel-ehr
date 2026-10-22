import type { ComponentProps } from "react";
import { cn } from "./cn";

export type ButtonVariant = "primary" | "secondary" | "danger" | "quiet" | "link";
export type ButtonSize = "sm" | "md" | "lg" | "cta";

/*
 * Hover and pressed states use `not-disabled` and `not-aria-disabled` rather than `enabled`, so they
 * also apply to links styled with `buttonStyles` (`:enabled` never matches an `<a>`). Tailwind's
 * `hover` already only applies on devices that can hover.
 */
const base =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-pill border font-medium transition-[color,background-color,border-color,box-shadow] duration-150 motion-reduce:transition-none disabled:cursor-not-allowed disabled:opacity-(--opacity-disabled) aria-disabled:cursor-not-allowed aria-disabled:opacity-(--opacity-disabled)";

const raised = "hover:not-disabled:not-aria-disabled:shadow-level-1 active:not-disabled:not-aria-disabled:shadow-none";

const variants: Record<ButtonVariant, string> = {
  primary: cn(
    "border-ink bg-ink text-page",
    "hover:not-disabled:not-aria-disabled:border-inverse-raised hover:not-disabled:not-aria-disabled:bg-inverse-raised",
    "active:not-disabled:not-aria-disabled:border-inverse-pressed active:not-disabled:not-aria-disabled:bg-inverse-pressed",
    raised,
  ),
  secondary: cn(
    "border-line bg-surface text-ink",
    "hover:not-disabled:not-aria-disabled:border-line-strong hover:not-disabled:not-aria-disabled:bg-surface-pure",
    "active:not-disabled:not-aria-disabled:bg-surface-pressed",
    raised,
  ),
  danger: cn(
    "border-danger bg-danger text-on-accent",
    "hover:not-disabled:not-aria-disabled:border-danger-raised hover:not-disabled:not-aria-disabled:bg-danger-raised",
    "active:not-disabled:not-aria-disabled:border-danger-ink active:not-disabled:not-aria-disabled:bg-danger-ink",
    raised,
  ),
  quiet: cn(
    "border-transparent bg-transparent text-ink-secondary",
    "hover:not-disabled:not-aria-disabled:bg-surface-warm hover:not-disabled:not-aria-disabled:text-ink",
    "active:not-disabled:not-aria-disabled:bg-surface-pressed",
    raised,
  ),
  // Text-only: underline on hover instead of a fill and shadow, darker text when pressed.
  link: cn(
    "border-transparent bg-transparent font-semibold text-accent underline-offset-2",
    "hover:not-disabled:not-aria-disabled:underline active:not-disabled:not-aria-disabled:text-accent-pressed",
  ),
};

const sizes: Record<ButtonSize, string> = {
  sm: "min-h-control-sm px-sm text-button-sm",
  md: "min-h-control-md px-md text-button-md",
  lg: "min-h-control-lg px-lg text-button-lg",
  cta: "min-h-cta w-full px-lg text-button-lg",
};

const linkSizes: Record<ButtonSize, string> = {
  sm: "min-h-control-sm px-1.5 text-button-sm",
  md: "min-h-9 px-1.5 text-button-md",
  lg: "min-h-control-lg px-1.5 text-button-lg",
  cta: "min-h-cta px-1.5 text-button-lg",
};

/** Class names for anything that should look like a button, such as a `next/link`. */
export function buttonStyles({
  variant = "primary",
  size = "md",
  className,
}: { variant?: ButtonVariant; size?: ButtonSize; className?: string } = {}): string {
  return cn(base, variants[variant], variant === "link" ? linkSizes[size] : sizes[size], className);
}

export type ButtonProps = ComponentProps<"button"> & { variant?: ButtonVariant; size?: ButtonSize };

/** Defaults to `type="button"`; pass `type="submit"` explicitly for form submission. */
export function Button({ variant, size, className, type = "button", ...props }: ButtonProps) {
  return <button type={type} className={buttonStyles({ variant, size, className })} {...props} />;
}
