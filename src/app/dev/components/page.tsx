import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import {
  AlertBanner,
  AttestationCheck,
  Avatar,
  Badge,
  Button,
  buttonStyles,
  CalendarIcon,
  Card,
  Checkbox,
  CloseIcon,
  FormErrors,
  FormField,
  FormMessage,
  NoAlert,
  PanelTitle,
  PillIcon,
  RadioOption,
  SearchIcon,
  SelectInput,
  SeverityTag,
  Spinner,
  StatusDot,
  SyntheticBanner,
  Tag,
  TextArea,
  TextInput,
  AlertCircleIcon,
  AlertTriangleIcon,
  CheckCircleIcon,
  CheckIcon,
  ChevronDownIcon,
  ClockIcon,
  InfoIcon,
  LockIcon,
} from "@/components/ui";
import { ContrastTable, type ContrastPair } from "../theme/contrast-table";
import { ComboboxDemo, ComboboxStatusDemo, DialogDemo, SubmitErrorsDemo } from "./demos";

export const metadata: Metadata = { title: "Component specimen (development only) | Kestrel EHR" };

// Static specimen for reviewing Phase 2 shared components. Synthetic sample text only; no data access.

const PAIRS: ContrastPair[] = [
  { label: "Badge accent: accent on accent-subtle", fg: "var(--color-accent)", bg: "var(--color-accent-subtle)", kind: "text" },
  { label: "Badge/Tag neutral: ink-secondary on surface-warm", fg: "var(--color-ink-secondary)", bg: "var(--color-surface-warm)", kind: "text" },
  { label: "Badge critical and warning: warning on warning-subtle", fg: "var(--color-warning)", bg: "var(--color-warning-subtle)", kind: "text" },
  { label: "Badge critical ring: warning-stroke on warning-subtle", fg: "var(--color-warning-stroke)", bg: "var(--color-warning-subtle)", kind: "ui" },
  { label: "Badge critical ring: warning-stroke on surface (hero)", fg: "var(--color-warning-stroke)", bg: "var(--color-surface)", kind: "ui" },
  { label: "SeverityTag critical and warning: warning on surface-pure", fg: "var(--color-warning)", bg: "var(--color-surface-pure)", kind: "text" },
  { label: "SeverityTag critical outline: warning-stroke on surface-pure", fg: "var(--color-warning-stroke)", bg: "var(--color-surface-pure)", kind: "ui" },
  { label: "SeverityTag critical outline: warning-stroke on surface (chart rows)", fg: "var(--color-warning-stroke)", bg: "var(--color-surface)", kind: "ui" },
  { label: "StatusDot critical ring: status-warning on surface", fg: "var(--color-status-warning)", bg: "var(--color-surface)", kind: "ui" },
  { label: "Cancel draft confirm (only red): on-accent on danger", fg: "var(--color-on-accent)", bg: "var(--color-danger)", kind: "text" },
  { label: "Cancel draft confirm hover: on-accent on danger-ink", fg: "var(--color-on-accent)", bg: "var(--color-danger-ink)", kind: "text" },
  { label: "Form error text: warning on surface", fg: "var(--color-warning)", bg: "var(--color-surface)", kind: "text" },
  { label: "Form error text: warning on page", fg: "var(--color-warning)", bg: "var(--color-page)", kind: "text" },
  { label: "warning-stroke text on warning-subtle (not used for text)", fg: "var(--color-warning-stroke)", bg: "var(--color-warning-subtle)", kind: "text" },
  { label: "warning-stroke text on page (not used for text)", fg: "var(--color-warning-stroke)", bg: "var(--color-page)", kind: "text" },
  { label: "Error stroke vs warning-subtle (field inside advisory)", fg: "var(--color-warning-stroke)", bg: "var(--color-warning-subtle)", kind: "ui" },
  { label: "Blocking banner/card/tile title: warning on warning-subtle", fg: "var(--color-warning)", bg: "var(--color-warning-subtle)", kind: "text" },
  { label: "Blocking fill: ink on warning-subtle", fg: "var(--color-ink)", bg: "var(--color-warning-subtle)", kind: "text" },
  { label: "Blocking fill: warning icon on warning-subtle", fg: "var(--color-warning)", bg: "var(--color-warning-subtle)", kind: "ui" },
  { label: "Blocking fill: focus ring on warning-subtle", fg: "var(--color-focus)", bg: "var(--color-warning-subtle)", kind: "ui" },
  { label: "Blocking outline (2px): warning-stroke on warning-subtle", fg: "var(--color-warning-stroke)", bg: "var(--color-warning-subtle)", kind: "ui" },
  { label: "Blocking outline (2px): warning-stroke on surface", fg: "var(--color-warning-stroke)", bg: "var(--color-surface)", kind: "ui" },
  { label: "Blocking outline (2px): warning-stroke on page", fg: "var(--color-warning-stroke)", bg: "var(--color-page)", kind: "ui" },
  { label: "Blocking banner icon: warning on surface-pure", fg: "var(--color-warning)", bg: "var(--color-surface-pure)", kind: "ui" },
  { label: "Blocking banner icon ring: warning-stroke on warning-subtle", fg: "var(--color-warning-stroke)", bg: "var(--color-warning-subtle)", kind: "ui" },
  { label: "Advisory outline (1px): warning-line on warning-subtle", fg: "var(--color-warning-line)", bg: "var(--color-warning-subtle)", kind: "decorative" },
  { label: "Advisory/blocking fill vs surface (alert inside a card)", fg: "var(--color-warning-subtle)", bg: "var(--color-surface)", kind: "decorative" },
  { label: "Banner body: ink-strong on warning-subtle", fg: "var(--color-ink-strong)", bg: "var(--color-warning-subtle)", kind: "text" },
  { label: "Attestation note: ink-strong on ok-subtle", fg: "var(--color-ink-strong)", bg: "var(--color-ok-subtle)", kind: "text" },
  { label: "Option note: ink-strong on accent-subtle", fg: "var(--color-ink-strong)", bg: "var(--color-accent-subtle)", kind: "text" },
  { label: "Suffix/placeholder on read-only: ink-secondary on surface-warm", fg: "var(--color-ink-secondary)", bg: "var(--color-surface-warm)", kind: "text" },
  { label: "Placeholder: ink-placeholder on surface", fg: "var(--color-ink-placeholder)", bg: "var(--color-surface)", kind: "text" },
  { label: "Success message: ok on surface", fg: "var(--color-ok)", bg: "var(--color-surface)", kind: "text" },
  { label: "Primary hover: page on inverse-hover", fg: "var(--color-page)", bg: "var(--color-inverse-hover)", kind: "text" },
  { label: "Quiet button: ink-secondary on surface", fg: "var(--color-ink-secondary)", bg: "var(--color-surface)", kind: "text" },
  { label: "NoAlert: ink-muted on page", fg: "var(--color-ink-muted)", bg: "var(--color-page)", kind: "text" },
  { label: "Avatar teal: on-accent on avatar-teal", fg: "var(--color-on-accent)", bg: "var(--color-avatar-teal)", kind: "text" },
  { label: "Avatar green: on-accent on avatar-green", fg: "var(--color-on-accent)", bg: "var(--color-avatar-green)", kind: "text" },
  { label: "Rail label: on-inverse-muted on inverse", fg: "var(--color-on-inverse-muted)", bg: "var(--color-inverse)", kind: "text" },
  { label: "Rail hover: on-inverse on inverse + 6% white", fg: "var(--color-on-inverse)", bg: "color-mix(in srgb, var(--color-on-inverse) 6%, var(--color-inverse))", kind: "text" },
  { label: "Rail current: on-inverse on inverse + 10% white", fg: "var(--color-on-inverse)", bg: "color-mix(in srgb, var(--color-on-inverse) 10%, var(--color-inverse))", kind: "text" },
  { label: "Rail focus outline: on-inverse on inverse", fg: "var(--color-on-inverse)", bg: "var(--color-inverse)", kind: "ui" },
  { label: "Theme focus ring on inverse (not used on the rail)", fg: "var(--color-focus)", bg: "var(--color-inverse)", kind: "ui" },
  { label: "Rail current marker: on-inverse on inverse", fg: "var(--color-on-inverse)", bg: "var(--color-inverse)", kind: "ui" },
  { label: "Rail current marker: on-inverse on inverse + 10% white", fg: "var(--color-on-inverse)", bg: "color-mix(in srgb, var(--color-on-inverse) 10%, var(--color-inverse))", kind: "ui" },
  { label: "Accent on inverse (not used for the rail marker)", fg: "var(--color-accent)", bg: "var(--color-inverse)", kind: "ui" },
  { label: "Identity avatar: page on ink", fg: "var(--color-page)", bg: "var(--color-ink)", kind: "text" },
  { label: "Identity role: ink-muted on page", fg: "var(--color-ink-muted)", bg: "var(--color-page)", kind: "text" },
  { label: "Synthetic banner: warning on warning-subtle", fg: "var(--color-warning)", bg: "var(--color-warning-subtle)", kind: "text" },
  { label: "Chart allergy name (all severities): warning on surface", fg: "var(--color-warning)", bg: "var(--color-surface)", kind: "text" },
  { label: "Chart allergy card icon (all severities): warning on surface", fg: "var(--color-warning)", bg: "var(--color-surface)", kind: "ui" },
  { label: "Chart allergy card outline (severe, 2px): warning-stroke on surface", fg: "var(--color-warning-stroke)", bg: "var(--color-surface)", kind: "ui" },
  { label: "Chart allergy card outline (severe, 2px): warning-stroke on page", fg: "var(--color-warning-stroke)", bg: "var(--color-page)", kind: "ui" },
  { label: "Chart hero allergy badge: warning on warning-subtle", fg: "var(--color-warning)", bg: "var(--color-warning-subtle)", kind: "text" },
  { label: "Chart banner body: ink-strong on warning-subtle", fg: "var(--color-ink-strong)", bg: "var(--color-warning-subtle)", kind: "text" },
  { label: "Chart banner Review draft link: page on ink (primary)", fg: "var(--color-page)", bg: "var(--color-ink)", kind: "text" },
  { label: "Chart banner Review draft link vs warning-subtle (primary edge)", fg: "var(--color-ink)", bg: "var(--color-warning-subtle)", kind: "ui" },
  { label: "Chart allergy card outline (mild/moderate): warning-line on surface", fg: "var(--color-warning-line)", bg: "var(--color-surface)", kind: "decorative" },
  { label: "Chart hero meta and allergy reaction: ink-strong on surface", fg: "var(--color-ink-strong)", bg: "var(--color-surface)", kind: "text" },
  { label: "Chart medication dose and drug class: ink-muted on surface", fg: "var(--color-ink-muted)", bg: "var(--color-surface)", kind: "text" },
  { label: "Chart prescription link: accent on surface", fg: "var(--color-accent)", bg: "var(--color-surface)", kind: "text" },
  { label: "Chart status note: ink-secondary on surface", fg: "var(--color-ink-secondary)", bg: "var(--color-surface)", kind: "text" },
  { label: "Chart back link: ink-secondary on page", fg: "var(--color-ink-secondary)", bg: "var(--color-page)", kind: "text" },
  { label: "Chart footer note: ink-muted on page", fg: "var(--color-ink-muted)", bg: "var(--color-page)", kind: "text" },
  { label: "Chart allergy row divider (all severities): warning-line on surface", fg: "var(--color-warning-line)", bg: "var(--color-surface)", kind: "decorative" },
  { label: "Draft status badge (neutral): ink-secondary on surface-warm", fg: "var(--color-ink-secondary)", bg: "var(--color-surface-warm)", kind: "text" },
  { label: "E-Rx review title: on-inverse on inverse", fg: "var(--color-on-inverse)", bg: "var(--color-inverse)", kind: "text" },
  { label: "E-Rx review subtitle: on-inverse-muted on inverse", fg: "var(--color-on-inverse-muted)", bg: "var(--color-inverse)", kind: "text" },
  { label: "E-Rx review count (neutral): on-inverse on inverse + 12% white", fg: "var(--color-on-inverse)", bg: "color-mix(in srgb, var(--color-on-inverse) 12%, var(--color-inverse))", kind: "text" },
  { label: "E-Rx review count (all addressed): on-accent on ok", fg: "var(--color-on-accent)", bg: "var(--color-ok)", kind: "text" },
  { label: "E-Rx review count (blocking and advisory): warning on warning-subtle", fg: "var(--color-warning)", bg: "var(--color-warning-subtle)", kind: "text" },
  { label: "E-Rx review count blocking outline (2px): warning-stroke on inverse", fg: "var(--color-warning-stroke)", bg: "var(--color-inverse)", kind: "ui" },
  { label: "E-Rx review count fill vs inverse header", fg: "var(--color-warning-subtle)", bg: "var(--color-inverse)", kind: "ui" },
  { label: "E-Rx saved summary labels: ink-strong on surface-warm", fg: "var(--color-ink-strong)", bg: "var(--color-surface-warm)", kind: "text" },
  { label: "E-Rx saved summary values: ink on surface-warm", fg: "var(--color-ink)", bg: "var(--color-surface-warm)", kind: "text" },
  { label: "E-Rx selected medication: ink on accent-subtle", fg: "var(--color-ink)", bg: "var(--color-accent-subtle)", kind: "text" },
  { label: "E-Rx Change link: accent on accent-subtle", fg: "var(--color-accent)", bg: "var(--color-accent-subtle)", kind: "text" },
  { label: "E-Rx drug class chip: ink-strong on surface-pure", fg: "var(--color-ink-strong)", bg: "var(--color-surface-pure)", kind: "text" },
  { label: "E-Rx selected medication outline: accent on surface", fg: "var(--color-accent)", bg: "var(--color-surface)", kind: "ui" },
  { label: "E-Rx tracker done check: on-accent on ok", fg: "var(--color-on-accent)", bg: "var(--color-ok)", kind: "ui" },
  { label: "E-Rx tracker done dot: ok on surface", fg: "var(--color-ok)", bg: "var(--color-surface)", kind: "ui" },
  { label: "E-Rx tracker open dot and SIG controls: line-field on surface", fg: "var(--color-line-field)", bg: "var(--color-surface)", kind: "ui" },
  { label: "E-Rx safety summary (clear): ok on ok-subtle", fg: "var(--color-ok)", bg: "var(--color-ok-subtle)", kind: "text" },
  { label: "E-Rx blocking card link: accent on warning-subtle", fg: "var(--color-accent)", bg: "var(--color-warning-subtle)", kind: "text" },
  { label: "E-Rx alert card guidance: ink-strong on warning-subtle", fg: "var(--color-ink-strong)", bg: "var(--color-warning-subtle)", kind: "text" },
  { label: "E-Rx severe allergy tile and safety summary: warning on warning-subtle", fg: "var(--color-warning)", bg: "var(--color-warning-subtle)", kind: "text" },
  { label: "E-Rx tile and summary detail: ink-strong on warning-subtle", fg: "var(--color-ink-strong)", bg: "var(--color-warning-subtle)", kind: "text" },
  { label: "E-Rx neutral tile: ink-strong on surface-warm", fg: "var(--color-ink-strong)", bg: "var(--color-surface-warm)", kind: "text" },
  { label: "E-Rx label preview text: ok on surface", fg: "var(--color-ok)", bg: "var(--color-surface)", kind: "text" },
];

const ICONS = {
  SearchIcon,
  LockIcon,
  CloseIcon,
  AlertTriangleIcon,
  AlertCircleIcon,
  InfoIcon,
  ChevronDownIcon,
  CalendarIcon,
  ClockIcon,
  PillIcon,
  CheckIcon,
  CheckCircleIcon,
};

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-card border border-line-subtle bg-surface p-6">
      <h2 className="mb-4 text-heading-sm font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Label({ children }: { children: ReactNode }) {
  return <p className="mb-2 font-mono text-label-sm text-ink-muted">{children}</p>;
}

export default function ComponentSpecimenPage() {
  if (process.env.NODE_ENV !== "development") notFound();

  return (
    <div className="flex flex-col">
      <SyntheticBanner />
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-7 py-8">
        <header className="flex flex-col gap-1">
          <p className="label-caps">Development only · Phase 2 review</p>
          <h1 className="font-display text-heading-xl font-medium tracking-tight">Kestrel component specimen</h1>
          <p className="max-w-prose text-ink-strong">
            Shared components in every state and size. Medication names, classes and messages are synthetic.
          </p>
        </header>

        <Section title="Buttons">
          <div className="flex flex-col gap-5">
            {(["primary", "secondary", "danger", "quiet", "link"] as const).map((variant) => (
              <div key={variant}>
                <Label>{variant}</Label>
                <div className="flex flex-wrap items-center gap-3">
                  {(["sm", "md", "lg"] as const).map((size) => (
                    <Button key={size} variant={variant} size={size}>
                      {variant} {size}
                    </Button>
                  ))}
                  <Button variant={variant} disabled>
                    disabled
                  </Button>
                </div>
              </div>
            ))}
            <div className="max-w-sm">
              <Label>cta (52px, full width)</Label>
              <Button size="cta">Sign prescription (simulated)</Button>
            </div>
            <div>
              <Label>buttonStyles on a link</Label>
              <a href="#buttons" className={buttonStyles({ size: "sm" })}>
                New prescription draft
              </a>
            </div>
          </div>
        </Section>

        <Section title="Input base: states × sizes">
          <div className="grid gap-x-6 gap-y-5 md:grid-cols-3">
            {(["sm", "md", "lg"] as const).map((size) => (
              <div key={size} className="flex flex-col gap-4">
                <Label>size {size}</Label>
                <FormField id={`default-${size}`} label="Default">
                  <TextInput size={size} placeholder="Placeholder" />
                </FormField>
                <FormField id={`filled-${size}`} label="Filled">
                  <TextInput size={size} defaultValue="Value text" />
                </FormField>
                <FormField id={`error-${size}`} label="Error" errors="Enter a whole number of 1 or more.">
                  <TextInput size={size} defaultValue="3.5" />
                </FormField>
                <FormField id={`disabled-${size}`} label="Disabled">
                  <TextInput size={size} disabled defaultValue="Locked by workflow" />
                </FormField>
                <FormField id={`readonly-${size}`} label="Read-only">
                  <TextInput size={size} readOnly value="30" suffix="tablets" />
                </FormField>
                <FormField id={`readonly-empty-${size}`} label="Read-only, empty">
                  <TextInput size={size} readOnly value="" />
                </FormField>
              </div>
            ))}
          </div>
          <p className="mt-4 text-label-sm text-ink-muted">Hover and Tab through the fields to see hover and focus.</p>
        </Section>

        <Section title="Slots and derived fields">
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            <FormField id="slot-search" label="Leading icon and shortcut">
              <TextInput
                leading={<SearchIcon />}
                placeholder="Search patients or MRN"
                trailing={
                  <kbd className="rounded-sm border border-line-subtle bg-surface-warm px-1.5 py-0.5 font-mono text-caption text-ink-secondary">
                    Ctrl K
                  </kbd>
                }
              />
            </FormField>
            <FormField id="slot-loading" label="Loading">
              <TextInput leading={<SearchIcon />} defaultValue="Rowan" trailing={<Spinner />} />
            </FormField>
            <FormField id="slot-suffix" label="Number with suffix" required helper="Tablets to dispense.">
              <TextInput type="number" defaultValue="30" suffix="tablets" />
            </FormField>
            <FormField id="slot-select" label="Select" helper="Route of administration.">
              <SelectInput defaultValue="oral">
                <option value="oral">Oral</option>
                <option value="topical">Topical</option>
              </SelectInput>
            </FormField>
            <FormField id="slot-date" label="Date">
              <TextInput type="date" leading={<CalendarIcon />} defaultValue="2026-10-19" />
            </FormField>
            <FormField id="slot-select-error" label="Select with error" errors="Choose a medication.">
              <SelectInput defaultValue="">
                <option value="">Choose a medication</option>
              </SelectInput>
            </FormField>
            <div className="md:col-span-2 xl:col-span-3">
              <FormField id="slot-textarea" label="Instructions (textarea)" helper="Up to 500 characters.">
                <TextArea rows={3} placeholder="Add an instruction" />
              </FormField>
            </div>
          </div>
        </Section>

        <Section title="Form Message and form-level errors">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label>helper</Label>
              <FormMessage>Pharmacy may dispense an equivalent (sample text).</FormMessage>
            </div>
            <div>
              <Label>error (amber, icon and text)</Label>
              <FormMessage tone="error">Enter a whole number of 1 or more.</FormMessage>
            </div>
            <div className="md:col-span-2">
              <Label>FormErrors</Label>
              <FormErrors messages={["The draft changed since you opened it. Reload to see the latest version."]} />
            </div>
            <div className="md:col-span-2" data-testid="submit-errors-demo">
              <Label>After a submit (announced)</Label>
              <SubmitErrorsDemo />
            </div>
          </div>
        </Section>

        <Section title="Combobox">
          <div className="grid gap-6 md:grid-cols-3">
            <div className="md:col-span-3">
              <ComboboxDemo />
            </div>
            <ComboboxStatusDemo status="loading" />
            <ComboboxStatusDemo status="error" />
          </div>
        </Section>

        <Section title="Checkbox, attestation and radio options">
          <div className="grid gap-6 md:grid-cols-3">
            <div className="flex flex-col gap-3">
              <Label>Checkbox</Label>
              <Checkbox label="Substitution allowed" description="Sample description text." />
              <Checkbox label="Checked" defaultChecked />
              <Checkbox label="Disabled" disabled />
            </div>
            <div className="flex flex-col gap-3">
              <Label>AttestationCheck</Label>
              <AttestationCheck label="I reviewed this synthetic draft." description="Unchecked" />
              <AttestationCheck label="I reviewed this synthetic draft." description="Checked" defaultChecked />
            </div>
            <fieldset className="flex flex-col gap-1.5">
              <legend className="mb-2 font-mono text-label-sm text-ink-muted">RadioOption</legend>
              <RadioOption name="demo-radio" label="Keep the current medication" defaultChecked />
              <RadioOption name="demo-radio" label="Change the medication" description="Sample description text." />
              <RadioOption name="demo-radio" label="Disabled option" disabled />
            </fieldset>
          </div>
        </Section>

        <Section title="Badges, tags, severity and status">
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <Label>Badge</Label>
              {(["neutral", "accent", "ok", "warning", "critical"] as const).map((tone) => (
                <Badge key={tone} tone={tone}>
                  {tone === "critical" ? "critical (blocking)" : tone}
                </Badge>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Label>Tag</Label>
              <Tag>Care team North</Tag>
              <Tag>SYN-000101</Tag>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Label>SeverityTag</Label>
              <SeverityTag severity="critical">Severe</SeverityTag>
              <SeverityTag severity="warning">Moderate</SeverityTag>
              <SeverityTag severity="warning">Mild</SeverityTag>
            </div>
            <div className="flex flex-wrap items-center gap-5">
              <Label>StatusDot</Label>
              {(["stable", "warning", "critical"] as const).map((tone) => (
                <span key={tone} className="flex items-center gap-2 text-label">
                  <StatusDot tone={tone} />
                  {tone === "critical" ? "critical (blocking)" : tone}
                </span>
              ))}
            </div>
            <p className="text-label-sm text-ink-strong">
              Blocking and advisory share the orange palette. Blocking adds the emphasis border width, the circle
              icon and its label, and is listed first. Red is reserved for destructive confirms.
            </p>
          </div>
        </Section>

        <div className="grid gap-6 xl:grid-cols-2">
          <Section title="Cards and panel titles">
            <div className="flex flex-col gap-4">
              <Card title="Card title" description="Sub text" actions={<Button size="sm">Action</Button>}>
                <p className="text-body-sm text-ink-strong">Default card, border.condition, radius 16.</p>
              </Card>
              <Card elevated>
                <PanelTitle icon={<PillIcon />}>Panel title</PanelTitle>
                <p className="mt-2 text-body-sm text-ink-strong">Elevated card with shadow level-1.</p>
              </Card>
              <Card tone="critical">
                <PanelTitle icon={<AlertCircleIcon />} tone="critical">
                  Allergies
                </PanelTitle>
                <p className="mt-2 text-body-sm text-ink-strong">
                  Critical-tone card: blocking emphasis outline (2px warning-stroke) and circle icon.
                </p>
              </Card>
            </div>
          </Section>

          <Section title="Alerts, avatars and dialog">
            <div className="flex flex-col gap-4">
              <AlertBanner tone="critical" title="Blocking demo alert" actions={<Button size="sm" variant="secondary">Review</Button>}>
                DEMO RULE sample text: change the medication or cancel the draft.
              </AlertBanner>
              <AlertBanner tone="warning" title="Advisory demo alert">
                DEMO RULE sample text: acknowledge before signing.
              </AlertBanner>
              <NoAlert>No demo alerts for this version.</NoAlert>
              <div className="flex items-center gap-3">
                <Avatar initials="RT" tone="teal" size="sm" />
                <Avatar initials="RT" tone="teal" />
                <Avatar initials="MG" tone="green" />
                <Avatar initials="QX" size="lg" />
              </div>
              <div>
                <DialogDemo />
              </div>
            </div>
          </Section>
        </div>

        <Section title="Icons">
          <ul className="flex flex-wrap gap-4">
            {Object.entries(ICONS).map(([name, Icon]) => (
              <li key={name} className="flex w-28 flex-col items-center gap-1.5 text-ink-strong">
                <Icon className="size-5" />
                <span className="font-mono text-caption text-ink-muted">{name.replace("Icon", "")}</span>
              </li>
            ))}
          </ul>
        </Section>

        <Section title="Contrast of component pairings (measured)">
          <ContrastTable pairs={PAIRS} />
        </Section>
      </main>
    </div>
  );
}
