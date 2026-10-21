import { cloneElement, type ComponentProps, type ReactElement, type ReactNode } from "react";
import { cn } from "./cn";
import { AlertTriangleIcon, ChevronDownIcon, LockIcon } from "./icons";

// Input System (.input-base, Form Message, Form Field). Form errors are amber, never red:
// red is reserved for destructive confirms.

export type FieldSize = "sm" | "md" | "lg";

type ControlState = {
  size?: FieldSize;
  invalid?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  multiline?: boolean;
};

const controlSizes: Record<FieldSize, string> = {
  sm: "min-h-control-sm px-xs text-control-sm",
  md: "min-h-control-md px-sm text-control-md",
  lg: "min-h-control-lg px-md text-control-lg",
};

function controlClass({ size = "md", invalid, disabled, readOnly, multiline }: ControlState): string {
  return cn(
    "flex w-full gap-2 rounded-control border-(length:--border-width-field) text-ink transition-[border-color,box-shadow] duration-100",
    multiline ? "items-start" : "items-center",
    controlSizes[size],
    disabled
      ? "cursor-not-allowed border-line-subtle bg-surface-warm text-ink-muted"
      : readOnly
        ? "border-line-field bg-surface-warm focus-within:focus-ring"
        : invalid
          ? "border-warning-stroke bg-surface error-ring focus-within:error-ring-focus"
          : "border-line-field bg-surface hover:border-line-strong focus-within:focus-ring",
  );
}

const nativeBase =
  "min-w-0 flex-1 self-stretch border-0 bg-transparent p-0 font-medium text-inherit outline-none placeholder:font-normal disabled:cursor-not-allowed";

/** Placeholder color per fill: `ink-placeholder` fails 4.5:1 on the warm read-only fill. */
function nativeClass(onWarmFill: boolean | undefined): string {
  return cn(nativeBase, onWarmFill ? "placeholder:text-ink-secondary" : "placeholder:text-ink-placeholder");
}

type Slots = {
  size?: FieldSize;
  /** Icon before the value, for example a search or calendar icon. */
  leading?: ReactNode;
  /** Unit after the value, for example "tablets". */
  suffix?: ReactNode;
  /** Clear button, shortcut hint, spinner. Read-only fields show a lock when this is empty. */
  trailing?: ReactNode;
  className?: string;
};

function isInvalid(value: ComponentProps<"input">["aria-invalid"]): boolean {
  return value === true || value === "true";
}

/** The bordered control shell. Use it directly only for composite controls such as the combobox. */
export function FieldControl({
  leading,
  suffix,
  trailing,
  className,
  children,
  ...state
}: Slots & ControlState & { children: ReactNode }) {
  return (
    <div className={cn(controlClass(state), className)}>
      {leading && <span className="flex text-ink-strong">{leading}</span>}
      {children}
      {suffix && (
        <span
          className={cn(
            "shrink-0 text-suffix",
            state.readOnly || state.disabled ? "text-ink-secondary" : "text-ink-placeholder",
          )}
        >
          {suffix}
        </span>
      )}
      {trailing && <span className="flex shrink-0 items-center gap-1.5 text-ink-strong">{trailing}</span>}
    </div>
  );
}

export type TextInputProps = Omit<ComponentProps<"input">, "size"> & Slots;

export function TextInput({ size, leading, suffix, trailing, className, ...props }: TextInputProps) {
  const emptyReadOnly = props.readOnly && (props.value === undefined || props.value === "") && !props.defaultValue;
  const emptyId = emptyReadOnly && props.id ? `${props.id}-empty` : undefined;
  return (
    <FieldControl
      size={size}
      invalid={isInvalid(props["aria-invalid"])}
      disabled={props.disabled}
      readOnly={props.readOnly}
      leading={leading}
      suffix={suffix}
      trailing={trailing ?? (props.readOnly ? <LockIcon /> : undefined)}
      className={className}
    >
      <input
        {...props}
        placeholder={emptyReadOnly ? "\u2014" : props.placeholder}
        aria-describedby={cn(props["aria-describedby"], emptyId) || undefined}
        className={nativeClass(props.readOnly || props.disabled)}
      />
      {emptyId && (
        <span id={emptyId} className="sr-only">
          No value
        </span>
      )}
    </FieldControl>
  );
}

export type SelectInputProps = Omit<ComponentProps<"select">, "size"> & Omit<Slots, "suffix" | "trailing">;

export function SelectInput({ size, leading, className, children, ...props }: SelectInputProps) {
  return (
    <FieldControl
      size={size}
      invalid={isInvalid(props["aria-invalid"])}
      disabled={props.disabled}
      leading={leading}
      trailing={<ChevronDownIcon />}
      className={cn("relative", className)}
    >
      <select {...props} className={cn(nativeClass(props.disabled), "cursor-pointer appearance-none")}>
        {children}
      </select>
    </FieldControl>
  );
}

export type TextAreaProps = ComponentProps<"textarea"> & Pick<Slots, "className">;

export function TextArea({ className, ...props }: TextAreaProps) {
  return (
    <FieldControl
      invalid={isInvalid(props["aria-invalid"])}
      disabled={props.disabled}
      readOnly={props.readOnly}
      multiline
      className={className}
    >
      <textarea {...props} className={cn(nativeClass(props.readOnly || props.disabled), "min-h-18 resize-y py-2.5")} />
    </FieldControl>
  );
}

/** Helper or error text under a control. Errors use an icon and text, not color alone. */
export function FormMessage({
  id,
  tone = "helper",
  className,
  children,
}: {
  id?: string;
  tone?: "helper" | "error";
  className?: string;
  children: ReactNode;
}) {
  const error = tone === "error";
  return (
    <p
      id={id}
      role={error ? "alert" : undefined}
      className={cn(
        "flex items-start gap-1.5 text-label-sm",
        error ? "font-medium text-warning" : "text-ink-secondary",
        className,
      )}
    >
      {error && <AlertTriangleIcon className="mt-0.5 size-3.5" />}
      <span>{children}</span>
    </p>
  );
}

type FieldChildProps = {
  id?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean | "true" | "false";
  "aria-required"?: boolean | "true" | "false";
};

/**
 * Label + control + message. Wires `id`, `aria-describedby`, `aria-invalid` and `aria-required`
 * onto its single child, so an error state always comes with its message.
 */
export function FormField({
  id,
  label,
  required = false,
  helper,
  errors,
  className,
  children,
}: {
  id: string;
  label: ReactNode;
  required?: boolean;
  helper?: ReactNode;
  errors?: string | string[];
  className?: string;
  children: ReactElement<FieldChildProps>;
}) {
  const errorList = errors === undefined ? [] : Array.isArray(errors) ? errors : [errors];
  const invalid = errorList.length > 0;
  const messageId = invalid || helper ? `${id}-message` : undefined;
  const control = cloneElement(children, {
    id,
    "aria-invalid": invalid || undefined,
    "aria-required": required || undefined,
    "aria-describedby": cn(children.props["aria-describedby"], messageId) || undefined,
  });

  return (
    <div className={cn("flex min-w-0 flex-col gap-1", className)}>
      <label htmlFor={id} id={`${id}-label`} className="text-label font-medium text-ink-strong">
        {label}
        {required && (
          <span aria-hidden="true" className="text-ink-muted">
            {" "}
            *
          </span>
        )}
      </label>
      {control}
      {invalid ? (
        <FormMessage id={messageId} tone="error">
          {errorList.join(" ")}
        </FormMessage>
      ) : (
        helper && <FormMessage id={messageId}>{helper}</FormMessage>
      )}
    </div>
  );
}

/** Form-level errors (amber). Field errors belong in `FormField`. */
export function FormErrors({ messages }: { messages?: string[] }) {
  if (!messages || messages.length === 0) return null;
  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-panel border border-warning-line bg-warning-subtle px-3 py-2.5 text-body-sm font-medium text-warning"
    >
      <AlertTriangleIcon className="mt-0.5" />
      <div className="flex flex-col gap-0.5">
        {messages.map((message) => (
          <p key={message}>{message}</p>
        ))}
      </div>
    </div>
  );
}
