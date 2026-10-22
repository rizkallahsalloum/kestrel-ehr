import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { AlertTriangleIcon, severityFill, severityIconText, severityOutline, severityText } from "@/components/ui";
import { ContrastTable, type ContrastPair } from "./contrast-table";

export const metadata: Metadata = { title: "Theme specimen (development only) | Kestrel EHR" };

// Static specimen for reviewing the Phase 1 theme. No data access, no components
// from the app; only raw elements styled with the theme utilities.

type Swatch = { name: string; token: string; note?: string };

const SWATCH_GROUPS: { title: string; swatches: Swatch[] }[] = [
  {
    title: "Surfaces",
    swatches: [
      { name: "page", token: "bg.page" },
      { name: "surface", token: "bg.surface" },
      { name: "surface-pure", token: "bg.surface-pure" },
      { name: "surface-warm", token: "bg.surface-hover" },
      { name: "inverse", token: "bg.inverse" },
      { name: "inverse-hover", token: "bg.inverse-hover" },
    ],
  },
  {
    title: "Text",
    swatches: [
      { name: "ink", token: "text.primary" },
      { name: "ink-strong", token: "text.strong", note: "labels, secondary text (C5)" },
      { name: "ink-secondary", token: "text.secondary", note: "helper text" },
      { name: "ink-muted", token: "text.muted", note: "tertiary text (C6)" },
      { name: "ink-placeholder", token: "text.placeholder" },
      { name: "on-inverse", token: "text.on-inverse", note: "rail text (HTML used #EDE9DF)" },
      { name: "on-inverse-muted", token: "fallback", note: "HTML rail secondary" },
    ],
  },
  {
    title: "Borders",
    swatches: [
      { name: "line-subtle", token: "border.condition", note: "cards, rows (C4)" },
      { name: "line", token: "border.default", note: "button outlines, options" },
      { name: "line-field", token: "border.field", note: "input stroke" },
      { name: "line-strong", token: "border.strong", note: "input hover" },
    ],
  },
  {
    title: "Accent and focus",
    swatches: [
      { name: "accent", token: "cyan.700 via primary.subtle-border", note: "C1" },
      { name: "accent-hover", token: "fallback" },
      { name: "accent-subtle", token: "primary.subtle" },
      { name: "focus", token: "focus.ring", note: "C3" },
      { name: "focus-glow", token: "focus.glow" },
    ],
  },
  {
    title: "Status",
    swatches: [
      { name: "ok", token: "success.default" },
      { name: "ok-subtle", token: "success.subtle" },
      { name: "warning", token: "fallback", note: "overrides warning.text (C7)" },
      { name: "warning-subtle", token: "fallback", note: "overrides warning.subtle (C7)" },
      { name: "warning-line", token: "fallback", note: "overrides border.warning (C7)" },
      { name: "warning-stroke", token: "warning.border-strong", note: "field error stroke" },
      { name: "danger", token: "error.default", note: "severe/critical outline, icon, tag; destructive confirm" },
      { name: "danger-ink", token: "error.hover", note: "severe/critical title text; destructive hover" },
      { name: "danger-subtle", token: "alert.critical.bg", note: "severe/critical fill" },
      { name: "danger-line", token: "border.warning-strong", note: "C8, severe allergy row dividers" },
    ],
  },
];

const CONTRAST_PAIRS: ContrastPair[] = [
  { label: "ink on surface", fg: "var(--color-ink)", bg: "var(--color-surface)", kind: "text" },
  { label: "ink-strong on surface", fg: "var(--color-ink-strong)", bg: "var(--color-surface)", kind: "text" },
  { label: "ink-secondary on surface", fg: "var(--color-ink-secondary)", bg: "var(--color-surface)", kind: "text" },
  { label: "ink-muted on surface", fg: "var(--color-ink-muted)", bg: "var(--color-surface)", kind: "text" },
  { label: "ink-muted on page", fg: "var(--color-ink-muted)", bg: "var(--color-page)", kind: "text" },
  { label: "ink-muted on surface-warm (avoid: use ink-secondary)", fg: "var(--color-ink-muted)", bg: "var(--color-surface-warm)", kind: "text" },
  { label: "ink-secondary on surface-warm", fg: "var(--color-ink-secondary)", bg: "var(--color-surface-warm)", kind: "text" },
  { label: "ink-placeholder on surface", fg: "var(--color-ink-placeholder)", bg: "var(--color-surface)", kind: "text" },
  { label: "on-inverse on inverse", fg: "var(--color-on-inverse)", bg: "var(--color-inverse)", kind: "text" },
  { label: "on-inverse-muted on inverse", fg: "var(--color-on-inverse-muted)", bg: "var(--color-inverse)", kind: "text" },
  { label: "page on ink (primary button)", fg: "var(--color-page)", bg: "var(--color-ink)", kind: "text" },
  { label: "accent on surface (links)", fg: "var(--color-accent)", bg: "var(--color-surface)", kind: "text" },
  { label: "on-accent on accent", fg: "var(--color-on-accent)", bg: "var(--color-accent)", kind: "text" },
  { label: "ink on accent-subtle", fg: "var(--color-ink)", bg: "var(--color-accent-subtle)", kind: "text" },
  { label: "ok on ok-subtle", fg: "var(--color-ok)", bg: "var(--color-ok-subtle)", kind: "text" },
  { label: "warning on warning-subtle", fg: "var(--color-warning)", bg: "var(--color-warning-subtle)", kind: "text" },
  { label: "warning-stroke on surface (field error text)", fg: "var(--color-warning-stroke)", bg: "var(--color-surface)", kind: "text" },
  { label: "danger on danger-subtle", fg: "var(--color-danger)", bg: "var(--color-danger-subtle)", kind: "text" },
  { label: "danger-ink on danger-subtle", fg: "var(--color-danger-ink)", bg: "var(--color-danger-subtle)", kind: "text" },
  { label: "on-accent on danger (danger button)", fg: "var(--color-on-accent)", bg: "var(--color-danger)", kind: "text" },
  { label: "line-field vs surface (input boundary)", fg: "var(--color-line-field)", bg: "var(--color-surface)", kind: "ui" },
  { label: "warning-stroke vs surface (error boundary)", fg: "var(--color-warning-stroke)", bg: "var(--color-surface)", kind: "ui" },
  { label: "focus vs surface (focus ring)", fg: "var(--color-focus)", bg: "var(--color-surface)", kind: "ui" },
  { label: "status-warning vs surface (status dot)", fg: "var(--color-status-warning)", bg: "var(--color-surface)", kind: "ui" },
  { label: "Figma status.warning vs surface (not used)", fg: "var(--k-semantic-status-warning)", bg: "var(--color-surface)", kind: "ui" },
  { label: "Figma warning.text on warning.subtle (not used)", fg: "var(--k-semantic-warning-text)", bg: "var(--k-semantic-warning-subtle)", kind: "text" },
  { label: "Figma alert.warning.default on alert.warning.bg (not used)", fg: "var(--k-semantic-alert-warning-default)", bg: "var(--k-semantic-alert-warning-bg)", kind: "text" },
];

const TYPE_SCALE = [
  ["text-display-lg", "Display lg 40"],
  ["text-display-md", "Display md 32"],
  ["text-heading-xl", "Heading xl 24"],
  ["text-heading-lg", "Heading lg 20"],
  ["text-heading-md", "Heading md 18"],
  ["text-heading-sm", "Heading sm 16"],
  ["text-body-lg", "Body lg 16"],
  ["text-body", "Body 14 (base)"],
  ["text-body-sm", "Body sm 13"],
  ["text-label", "Label 13"],
  ["text-label-sm", "Label sm 12"],
  ["text-caption", "Caption 11"],
  ["text-control-lg", "Control lg 16"],
  ["text-control-md", "Control md 14"],
  ["text-control-sm", "Control sm 12"],
  ["font-mono text-code-lg", "Code lg 14"],
  ["font-mono text-code-md", "Code md 13"],
  ["font-mono text-code-sm", "Code sm 12"],
] as const;

const WRAP_SAMPLES = [
  ["font-display text-display-lg font-medium", "display-lg 40/40 (Fraunces)"],
  ["font-display text-display-md font-medium", "display-md 32/40 (Fraunces)"],
  ["font-display text-heading-xl font-medium", "heading-xl 24/32 (Fraunces)"],
  ["text-heading-xl font-semibold", "heading-xl 24/32"],
  ["text-heading-lg font-semibold", "heading-lg 20/28"],
  ["text-heading-md font-semibold", "heading-md 18/24"],
  ["text-heading-sm font-semibold", "heading-sm 16/24"],
  ["font-mono text-data-lg font-medium", "data-lg 32/40 (mono)"],
] as const;

const FALLBACKS = [
  "on-inverse-muted #9AA39C (no semantic token; same value as primitive gray.600)",
  "accent-hover #1F5058 (no semantic token)",
  "warning #8A5A0E and warning-subtle #F8EDD6 override Figma warning.text / warning.subtle (fails AA)",
  "warning-line #E9D6AC overrides Figma border.warning (identical to its fill)",
  "status-warning uses warning.border-strong #9C6A15 instead of Figma status.warning #C98A2A (2.89:1)",
  "radius panel 12px (no Figma radius between 8 and 16)",
  "display font Fraunces (HTML only; Figma families are Inter and IBM Plex Mono)",
  "touch 44px and cta 52px targets, breakpoints and fade-up motion (HTML only)",
  "line-height per size: Figma defines roles; pairing with sizes is inferred",
];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-card border border-line-subtle bg-surface p-6 shadow-level-1">
      <h2 className="mb-4 text-heading-sm font-semibold">{title}</h2>
      {children}
    </section>
  );
}

export default function ThemeSpecimenPage() {
  if (process.env.NODE_ENV !== "development") notFound();

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-7 py-8">
      <header className="flex flex-col gap-1">
        <p className="label-caps">Development only · Phase 1 review</p>
        <h1 className="font-display text-heading-xl font-medium tracking-tight">Kestrel theme specimen</h1>
        <p className="max-w-prose text-ink-strong">
          Tokens, fonts, global styles and Tailwind theme. Sample text is synthetic. Components and pages are not part
          of Phase 1.
        </p>
      </header>

      <Section title="Colors">
        <div className="flex flex-col gap-6">
          {SWATCH_GROUPS.map((group) => (
            <div key={group.title}>
              <h3 className="label-caps mb-3">{group.title}</h3>
              <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
                {group.swatches.map((swatch) => (
                  <li key={swatch.name} className="overflow-hidden rounded-panel border border-line-subtle">
                    <div className="h-14 border-b border-line-subtle" style={{ background: `var(--color-${swatch.name})` }} />
                    <div className="p-2.5">
                      <p className="font-mono text-label-sm font-medium">{swatch.name}</p>
                      <p className="text-label-sm text-ink-muted">{swatch.token}</p>
                      {swatch.note && <p className="text-label-sm text-ink-secondary">{swatch.note}</p>}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Contrast (measured from the rendered theme)">
        <ContrastTable pairs={CONTRAST_PAIRS} />
      </Section>

      <Section title="Typography">
        <div className="grid gap-6 xl:grid-cols-workspace">
          <ul className="flex flex-col gap-2">
            {TYPE_SCALE.map(([cls, label]) => (
              <li key={cls} className="flex items-baseline gap-4 border-b border-line-subtle pb-2 last:border-0">
                <span className="w-32 shrink-0 font-mono text-label-sm text-ink-muted">{cls}</span>
                <span className={cls}>{label}</span>
              </li>
            ))}
          </ul>
          <div className="flex flex-col gap-4">
            <div>
              <p className="label-caps mb-1">Display (Fraunces)</p>
              <p className="font-display text-heading-xl font-medium tracking-tight">Rowan Testcase</p>
            </div>
            <div>
              <p className="label-caps mb-1">Sans (Inter)</p>
              <p>
                Regular 400, <span className="font-medium">medium 500</span>,{" "}
                <span className="font-semibold">semibold 600</span>, <span className="font-bold">bold 700</span>
              </p>
            </div>
            <div>
              <p className="label-caps mb-1">Mono (IBM Plex Mono)</p>
              <p className="font-mono text-body-sm text-ink-strong">SYN-000101 · DOB 1959-03-14 · 10 mg oral once daily</p>
            </div>
            <div>
              <p className="label-caps mb-1">Micro-label utility</p>
              <p className="label-caps">Active allergies</p>
            </div>
          </div>
        </div>
      </Section>

      <Section title="Display and heading line heights (wrapped, provisional pairing)">
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {WRAP_SAMPLES.map(([cls, label]) => (
            <div key={cls} data-testid="wrap-sample">
              <p className="mb-1 font-mono text-label-sm text-ink-muted">{label}</p>
              <p className={`${cls} max-w-[14ch] bg-accent-subtle`}>Rowan Testcase, synthetic chart</p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-label-sm text-ink-muted">
          The tinted box shows each line box. Ascenders and descenders should not touch between lines.
        </p>
      </Section>

      <div className="grid gap-6 xl:grid-cols-2">
        <Section title="Radii and shadows">
          <div className="grid grid-cols-3 gap-4">
            {[
              ["rounded-sm", "sm 4"],
              ["rounded-control", "control 8"],
              ["rounded-panel", "panel 12"],
              ["rounded-card", "card 16"],
              ["rounded-pill", "pill"],
            ].map(([cls, label]) => (
              <div key={cls} className={`${cls} flex h-16 items-center justify-center border border-line bg-surface-warm text-label-sm`}>
                {label}
              </div>
            ))}
            <div className="flex h-16 items-center justify-center rounded-card bg-surface text-label-sm shadow-level-1">
              level-1
            </div>
            <div className="flex h-16 items-center justify-center rounded-card bg-surface text-label-sm shadow-level-2">
              level-2
            </div>
          </div>
        </Section>

        <Section title="Control heights, focus and field strokes">
          <div className="flex flex-col gap-3">
            {[
              ["h-control-sm", "sm 32"],
              ["h-control-md", "md 40"],
              ["h-control-lg", "lg 48"],
            ].map(([cls, label]) => (
              <label key={cls} className="flex items-center gap-3 text-label">
                <span className="w-14 font-mono text-label-sm text-ink-muted">{label}</span>
                <input
                  className={`${cls} w-full rounded-control border-(length:--border-width-field) border-line-field bg-surface px-3 font-medium placeholder:font-normal placeholder:text-ink-placeholder hover:border-line-strong focus-visible:focus-ring focus-visible:outline-none`}
                  placeholder="Tab here to see the focus ring"
                />
              </label>
            ))}
            <div className="flex items-center gap-3 text-label">
              <span className="w-14 font-mono text-label-sm text-ink-muted">error</span>
              <div className="flex h-control-md w-full items-center rounded-control border-(length:--border-width-field) border-warning-stroke bg-surface px-3 font-medium error-ring">
                Field error stroke (amber, never red)
              </div>
            </div>
            <div className="flex items-center gap-3 text-label">
              <span className="w-14 font-mono text-label-sm text-ink-muted">touch</span>
              <div className="flex min-h-touch w-full items-center rounded-control border border-line bg-surface px-3">
                44px minimum for options and rows
              </div>
            </div>
          </div>
        </Section>
      </div>

      <Section title="Status surfaces (illustrative, synthetic text)">
        <div className="grid gap-4 md:grid-cols-3">
          <div className={`rounded-card p-4 ${severityFill.critical} ${severityOutline.critical}`}>
            <p className={`flex items-center gap-1.5 text-body-sm font-semibold ${severityText.critical}`}>
              <AlertTriangleIcon className={severityIconText.critical} />
              Blocking demo alert
            </p>
            <p className="text-body-sm text-ink-strong">DEMO RULE sample text: red, emphasis outline.</p>
          </div>
          <div className={`rounded-card p-4 ${severityFill.warning} ${severityOutline.warning}`}>
            <p className={`flex items-center gap-1.5 text-body-sm font-semibold ${severityText.warning}`}>
              <AlertTriangleIcon className={severityIconText.warning} />
              Advisory demo alert
            </p>
            <p className="text-body-sm text-ink-strong">DEMO RULE sample text on the warning surface.</p>
          </div>
          <div className="rounded-card border border-ok bg-ok-subtle p-4">
            <p className="text-body-sm font-semibold text-ok">All demo alerts addressed</p>
            <p className="text-body-sm text-ink-strong">Sample text on the success surface.</p>
          </div>
        </div>
        <div className="mt-4 overflow-hidden rounded-card bg-inverse p-4">
          <p className="text-body-sm font-semibold text-on-inverse">Inverse surface (rail, review header)</p>
          <p className="text-label-sm text-on-inverse-muted">Secondary text on the inverse surface</p>
        </div>
        <div className="mt-4 flex flex-wrap gap-6">
          {(["status-stable", "status-warning", "status-critical"] as const).map((name) => (
            <span key={name} className="flex items-center gap-2 text-label">
              <span className="size-2 rounded-full" style={{ background: `var(--color-${name})` }} aria-hidden="true" />
              {name}
            </span>
          ))}
        </div>
      </Section>

      <Section title="Motion">
        <div className="flex gap-3">
          {[0, 40, 80, 120, 160].map((delay) => (
            <div
              key={delay}
              className="flex h-12 flex-1 animate-fade-up items-center justify-center rounded-panel border border-line-subtle bg-surface-warm font-mono text-label-sm"
              style={{ animationDelay: `${delay}ms` }}
            >
              {delay}ms
            </div>
          ))}
        </div>
        <p className="mt-2 text-label-sm text-ink-muted">Reload to replay. Disabled when reduced motion is requested.</p>
      </Section>

      <Section title="Values not taken from the Figma export">
        <ul className="list-disc pl-5 text-body-sm text-ink-strong">
          {FALLBACKS.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </Section>
    </main>
  );
}
