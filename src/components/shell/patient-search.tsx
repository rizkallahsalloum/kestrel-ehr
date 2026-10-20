"use client";

import Form from "next/form";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";
import { SearchIcon, TextInput } from "@/components/ui";
import { PATIENT_QUERY_MAX } from "@/features/patients/search";

const INPUT_ID = "patient-search";
const TYPING_TARGETS = "input, textarea, select, [contenteditable=''], [contenteditable='true']";

type SearchProps = { action: string; hiddenFields?: Record<string, string> };

/** Focuses the search on `/` (outside text fields) and on Ctrl/⌘K, except while a dialog is open. */
function useSearchShortcuts() {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || document.querySelector("dialog[open]")) return;
      const input = document.getElementById(INPUT_ID);
      if (!(input instanceof HTMLInputElement)) return;

      const palette = event.key.toLowerCase() === "k" && (event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey;
      const typing = event.target instanceof Element && event.target.closest(TYPING_TARGETS);
      const slash = event.key === "/" && !event.ctrlKey && !event.metaKey && !event.altKey && !typing;
      if (!palette && !slash) return;

      event.preventDefault();
      input.focus();
      input.select();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}

function SearchForm({ action, hiddenFields, query }: SearchProps & { query: string }) {
  useSearchShortcuts();
  return (
    <Form action={action} role="search" aria-label="Patients" className="w-full">
      {Object.entries(hiddenFields ?? {}).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <label htmlFor={INPUT_ID} className="sr-only">
        Search patients by name or MRN
      </label>
      <TextInput
        key={query}
        id={INPUT_ID}
        name="q"
        type="search"
        defaultValue={query}
        placeholder="Search patients or MRN"
        maxLength={PATIENT_QUERY_MAX}
        autoComplete="off"
        enterKeyHint="search"
        aria-keyshortcuts="/ Control+K Meta+K"
        leading={<SearchIcon />}
        trailing={
          <kbd
            aria-hidden="true"
            className="rounded-sm border border-line-subtle bg-surface-warm px-1.5 py-px font-mono text-caption text-ink-secondary"
          >
            /
          </kbd>
        }
      />
    </Form>
  );
}

function CurrentSearch(props: SearchProps) {
  const pathname = usePathname();
  const params = useSearchParams();
  const query = pathname === props.action ? (params.get("q") ?? "") : "";
  return <SearchForm {...props} query={query} />;
}

/** Top-bar patient search: a GET form to the patient list, filtered on the server (plan D6). */
export function PatientSearch({ action = "/patients", hiddenFields }: Partial<SearchProps>) {
  return (
    <Suspense fallback={<SearchForm action={action} hiddenFields={hiddenFields} query="" />}>
      <CurrentSearch action={action} hiddenFields={hiddenFields} />
    </Suspense>
  );
}
