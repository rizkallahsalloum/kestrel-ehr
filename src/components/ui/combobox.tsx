"use client";

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "./cn";
import { FieldControl, type FieldSize } from "./field";
import { AlertTriangleIcon, ChevronDownIcon, CloseIcon, SearchIcon, Spinner } from "./icons";

export type ComboboxOption = {
  value: string;
  label: string;
  description?: string;
  /** Short tag shown at the end of the row, for example a demo drug class. */
  meta?: string;
};

export type ComboboxProps = {
  id?: string;
  /** Submits the selected value with the surrounding form. */
  name?: string;
  options: ComboboxOption[];
  value: string | null;
  onValueChange: (value: string | null) => void;
  placeholder?: string;
  size?: FieldSize;
  /** "loading" and "error" describe the source list, for example while the server responds. */
  status?: "idle" | "loading" | "error";
  errorMessage?: string;
  noMatchesMessage?: (query: string) => string;
  disabled?: boolean;
  leading?: ReactNode;
  "aria-label"?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean | "true" | "false";
  "aria-required"?: boolean | "true" | "false";
};

function matches(option: ComboboxOption, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return option.label.toLowerCase().includes(q) || Boolean(option.description?.toLowerCase().includes(q));
}

function Highlight({ text, query }: { text: string; query: string }) {
  const q = query.trim();
  const index = q ? text.toLowerCase().indexOf(q.toLowerCase()) : -1;
  if (index < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, index)}
      <mark className="bg-transparent font-bold text-accent">{text.slice(index, index + q.length)}</mark>
      {text.slice(index + q.length)}
    </>
  );
}

/**
 * Single-select combobox over a list the server already provided (Input System search and
 * medication combobox). Filtering is client-side only; it never fetches.
 */
export function Combobox({
  id: idProp,
  name,
  options,
  value,
  onValueChange,
  placeholder,
  size = "md",
  status = "idle",
  errorMessage = "The list could not be loaded.",
  noMatchesMessage = (q) => `No matches for \u201c${q}\u201d.`,
  disabled,
  leading = <SearchIcon />,
  ...aria
}: ComboboxProps) {
  const fallbackId = useId();
  const id = idProp ?? fallbackId;
  const listId = `${id}-listbox`;
  const selected = options.find((option) => option.value === value) ?? null;

  const [query, setQuery] = useState(selected?.label ?? "");
  const [typed, setTyped] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const results = useMemo(
    () => (typed ? options.filter((option) => matches(option, query)) : options),
    [options, query, typed],
  );
  const showList = open && status === "idle" && results.length > 0;
  const activeId = showList && active >= 0 ? `${id}-option-${active}` : undefined;

  useEffect(() => {
    if (!activeId) return;
    listRef.current?.querySelector(`#${CSS.escape(activeId)}`)?.scrollIntoView?.({ block: "nearest" });
  }, [activeId]);

  const close = () => {
    setOpen(false);
    setActive(-1);
    setTyped(false);
    setQuery(selected?.label ?? "");
  };

  const choose = (option: ComboboxOption) => {
    onValueChange(option.value);
    setQuery(option.label);
    setTyped(false);
    setOpen(false);
    setActive(-1);
  };

  const clear = () => {
    onValueChange(null);
    setQuery("");
    setTyped(true);
    setOpen(true);
    setActive(-1);
    inputRef.current?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    const count = results.length;
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        setOpen(true);
        if (count) setActive((i) => (i + 1) % count);
        break;
      case "ArrowUp":
        event.preventDefault();
        setOpen(true);
        if (count) setActive((i) => (i <= 0 ? count - 1 : i - 1));
        break;
      case "Enter":
        if (open && active >= 0 && results[active]) {
          event.preventDefault();
          choose(results[active]);
        }
        break;
      case "Escape":
        if (open) {
          event.preventDefault();
          close();
        }
        break;
      case "Tab":
        if (open) close();
        break;
    }
  };

  const announcement = !open
    ? ""
    : status === "loading"
      ? "Loading results."
      : status === "error"
        ? errorMessage
        : results.length === 0
          ? noMatchesMessage(query)
          : `${results.length} result${results.length === 1 ? "" : "s"} available.`;

  return (
    <div className="relative">
      <FieldControl
        size={size}
        invalid={aria["aria-invalid"] === true || aria["aria-invalid"] === "true"}
        disabled={disabled}
        leading={leading}
        trailing={
          status === "loading" ? (
            <Spinner />
          ) : query && !disabled ? (
            <button
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={clear}
              aria-label="Clear"
              className="grid size-7 place-items-center rounded-sm text-ink-strong hover:bg-surface-warm"
            >
              <CloseIcon />
            </button>
          ) : (
            <ChevronDownIcon />
          )
        }
      >
        <input
          ref={inputRef}
          id={id}
          type="text"
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={activeId}
          autoComplete="off"
          spellCheck={false}
          disabled={disabled}
          placeholder={placeholder}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setTyped(true);
            setOpen(true);
            setActive(-1);
          }}
          onFocus={() => setOpen(true)}
          onClick={() => setOpen(true)}
          onBlur={close}
          onKeyDown={onKeyDown}
          className="min-w-0 flex-1 self-stretch border-0 bg-transparent p-0 font-medium text-inherit outline-none placeholder:font-normal placeholder:text-ink-placeholder disabled:cursor-not-allowed"
          {...aria}
        />
      </FieldControl>
      {name && <input type="hidden" name={name} value={value ?? ""} />}

      <ul
        ref={listRef}
        id={listId}
        role="listbox"
        aria-label={aria["aria-label"]}
        hidden={!open}
        className="absolute inset-x-0 z-20 mt-1.5 max-h-85 overflow-auto rounded-panel border border-line-subtle bg-surface p-1.5 shadow-level-2"
      >
        {status === "loading" ? (
          [0, 1, 2].map((row) => (
            <li key={row} aria-hidden="true" className="m-1 h-11 animate-pulse rounded-control bg-surface-warm" />
          ))
        ) : status === "error" ? (
          <li className="flex items-center gap-2 px-3 py-3.5 text-body-sm font-medium text-warning">
            <AlertTriangleIcon />
            {errorMessage}
          </li>
        ) : results.length === 0 ? (
          <li className="px-3 py-3.5 text-body-sm text-ink-secondary">{noMatchesMessage(query)}</li>
        ) : (
          results.map((option, index) => (
            <li
              key={option.value}
              id={`${id}-option-${index}`}
              role="option"
              aria-selected={index === active}
              onMouseDown={(event) => {
                event.preventDefault();
                choose(option);
              }}
              onMouseMove={() => setActive(index)}
              className={cn(
                "flex min-h-touch cursor-pointer items-center gap-2.5 rounded-control px-2.5 py-2",
                index === active && "bg-accent-subtle",
              )}
            >
              <div className="min-w-0 flex-1">
                <p className="text-body-sm font-semibold text-ink">
                  <Highlight text={option.label} query={typed ? query : ""} />
                </p>
                {option.description && <p className="text-label-sm text-ink-strong">{option.description}</p>}
              </div>
              {option.meta && (
                <span className="shrink-0 rounded-pill bg-surface-warm px-2 py-px font-mono text-label-sm text-ink-secondary">
                  {option.meta}
                </span>
              )}
            </li>
          ))
        )}
      </ul>
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </div>
  );
}
