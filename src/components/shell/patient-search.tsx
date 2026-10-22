"use client";

import Form from "next/form";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useLayoutEffect, useRef } from "react";
import { SearchIcon, TextInput } from "@/components/ui";
import { PATIENT_QUERY_MAX } from "@/features/patients/search";
import { usePrivacy } from "@/features/privacy/components/privacy-provider";

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
  usePrivacyQueryReset(params.toString());
  const query = pathname === props.action ? (params.get("q") ?? "") : "";
  return <SearchForm {...props} query={query} />;
}

const currentUrl = () => window.location.pathname + window.location.search + window.location.hash;

/**
 * The search field and `?q=` are not masked in place, so Privacy mode empties the field and drops
 * `q` from the address bar (history.replaceState: no request, the masked list is unchanged).
 * Turning Privacy off puts `q` back if the URL is still the stripped one. Unsubmitted text is not restored.
 */
function usePrivacyQueryReset(search: string) {
  const { on } = usePrivacy();
  const stripped = useRef<{ from: string; to: string } | null>(null);

  useLayoutEffect(() => {
    if (on) {
      const input = document.getElementById(INPUT_ID);
      if (input instanceof HTMLInputElement) input.value = "";
      const url = new URL(window.location.href);
      if (!url.searchParams.has("q")) return;
      const from = currentUrl();
      url.searchParams.delete("q");
      const to = url.pathname + url.search + url.hash;
      window.history.replaceState(null, "", to);
      stripped.current = { from, to };
    } else if (stripped.current) {
      const { from, to } = stripped.current;
      stripped.current = null;
      if (currentUrl() === to) window.history.replaceState(null, "", from);
    }
  }, [on, search]);
}

/** Top-bar patient search: a GET form to the patient list, filtered on the server (plan D6). */
export function PatientSearch({ action = "/patients", hiddenFields }: Partial<SearchProps>) {
  return (
    <Suspense fallback={<SearchForm action={action} hiddenFields={hiddenFields} query="" />}>
      <CurrentSearch action={action} hiddenFields={hiddenFields} />
    </Suspense>
  );
}
