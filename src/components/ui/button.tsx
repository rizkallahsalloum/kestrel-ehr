import type { ComponentProps } from "react";
import { cn } from "./cn";

export type ButtonVariant = "primary" | "secondary" | "danger" | "quiet" | "link";
export type ButtonSize = "sm" | "md" | "lg" | "cta";

const base =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-pill border font-medium transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-(--opacity-disabled) aria-disabled:cursor-not-allowed aria-disabled:opacity-(--opacity-disabled)";

const variants: Record<ButtonVariant, string> = {
  primary: "border-ink bg-ink text-page enabled:hover:border-inverse-hover enabled:hover:bg-inverse-hover",
  secondary: "border-line bg-surface text-ink enabled:hover:border-line-strong",
  danger: "border-danger bg-danger text-on-accent enabled:hover:border-danger-ink enabled:hover:bg-danger-ink",
  quiet: "border-transparent bg-transparent text-ink-secondary enabled:hover:bg-surface-warm enabled:hover:text-ink",
  link: "border-transparent bg-transparent font-semibold text-accent underline-offset-2 enabled:hover:underline",
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
