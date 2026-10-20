import type { ComponentProps, ReactNode } from "react";
import { cn } from "./cn";

type ChoiceProps = Omit<ComponentProps<"input">, "type" | "children"> & {
  label: ReactNode;
  description?: ReactNode;
};

const box = "size-4.5 shrink-0";

/** Plain checkbox with a label and optional description (E-Rx `.chk`). */
export function Checkbox({ label, description, className, ...props }: ChoiceProps) {
  return (
    <label className={cn("flex cursor-pointer items-start gap-2.5 text-body-sm has-disabled:cursor-not-allowed", className)}>
      <input type="checkbox" className={cn(box, "mt-px")} {...props} />
      <span>
        <span className="block font-medium">{label}</span>
        {description && <span className="block text-label-sm text-ink-secondary">{description}</span>}
      </span>
    </label>
  );
}

/** Bordered attestation that turns green when checked (E-Rx `.att`). */
export function AttestationCheck({ label, description, className, ...props }: ChoiceProps) {
  return (
    <label
      className={cn(
        "flex min-h-touch cursor-pointer items-start gap-2.5 rounded-panel border border-line bg-surface px-3.5 py-3 text-body-sm transition-colors has-checked:border-ok has-checked:bg-ok-subtle has-disabled:cursor-not-allowed",
        className,
      )}
    >
      <input type="checkbox" className={cn(box, "mt-px")} {...props} />
      <span>
        <span className="block">{label}</span>
        {description && <span className="mt-0.5 block text-label-sm text-ink-strong">{description}</span>}
      </span>
    </label>
  );
}

/** Radio row that highlights when selected (E-Rx `.opt`). Group with a `fieldset` and `legend`. */
export function RadioOption({ label, description, className, ...props }: ChoiceProps) {
  return (
    <label
      className={cn(
        "flex min-h-touch cursor-pointer items-center gap-2.5 rounded-control border border-line bg-surface px-2.5 py-2 text-body-sm transition-colors has-checked:border-accent has-checked:bg-accent-subtle has-disabled:cursor-not-allowed",
        className,
      )}
    >
      <input type="radio" className={box} {...props} />
      <span>
        <span className="block">{label}</span>
        {description && <span className="block text-label-sm text-ink-strong">{description}</span>}
      </span>
    </label>
  );
}
