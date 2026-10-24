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
  AlertTriangleIcon,
  BillingIcon,
  CheckCircleIcon,
  CheckIcon,
  ChevronDownIcon,
  ClockIcon,
  InfoIcon,
  LockIcon,
  ChartIcon,
  EyeIcon,
  EyeOffIcon,
  FlaskIcon,
  RxIcon,
} from "@/components/ui";
import { PatientQueueItem } from "@/features/patients/components/patient-queue-item";
import { QUEUE_AVATAR_TONES, queueAvatarTones } from "@/features/patients/queue";
import { DEMO_QUEUE } from "../demo-queue";
import { ContrastTable, type ContrastPair } from "../theme/contrast-table";
import { ComboboxDemo, ComboboxStatusDemo, DialogDemo, SubmitErrorsDemo } from "./demos";

export const metadata: Metadata = { title: "Component specimen (development only) | Kestrel EHR" };

// Static specimen for reviewing Phase 2 shared components. Synthetic sample text only; no data access.

const PAIRS: ContrastPair[] = [
  { label: "Privacy mask in a form field: ink-strong on surface-warm", fg: "var(--color-ink-strong)", bg: "var(--color-surface-warm)", kind: "text" },
  { label: "Privacy mask field edge: line-field vs surface", fg: "var(--color-line-field)", bg: "var(--color-surface)", kind: "ui" },
  { label: "Privacy mask, lightest inline use: ink-muted on surface (medication dose)", fg: "var(--color-ink-muted)", bg: "var(--color-surface)", kind: "text" },
  { label: "Privacy mask in a link: accent on surface (patient list)", fg: "var(--color-accent)", bg: "var(--color-surface)", kind: "text" },
  { label: "Privacy mask in an advisory alert: ink-strong on warning-subtle", fg: "var(--color-ink-strong)", bg: "var(--color-warning-subtle)", kind: "text" },
  { label: "Privacy mask in a blocking alert: ink-strong on danger-subtle", fg: "var(--color-ink-strong)", bg: "var(--color-danger-subtle)", kind: "text" },
  { label: "Privacy button off (12px): ink-secondary on page", fg: "var(--color-ink-secondary)", bg: "var(--color-page)", kind: "text" },
  { label: "Privacy button off, hovered: ink-secondary on surface-warm", fg: "var(--color-ink-secondary)", bg: "var(--color-surface-warm)", kind: "text" },
  { label: "Privacy button on (12px): ok on page", fg: "var(--color-ok)", bg: "var(--color-page)", kind: "text" },
  { label: "Privacy button on, hovered: ok on surface-warm", fg: "var(--color-ok)", bg: "var(--color-surface-warm)", kind: "text" },
  { label: "Privacy button focus ring: focus vs page", fg: "var(--color-focus)", bg: "var(--color-page)", kind: "ui" },
  { label: "Badge accent: accent on accent-subtle", fg: "var(--color-accent)", bg: "var(--color-accent-subtle)", kind: "text" },
  { label: "Badge/Tag neutral: ink-secondary on surface-warm", fg: "var(--color-ink-secondary)", bg: "var(--color-surface-warm)", kind: "text" },
  { label: "Badge warning (12px): warning on warning-subtle", fg: "var(--color-warning)", bg: "var(--color-warning-subtle)", kind: "text" },
  { label: "Badge critical and allergy pill (12px): danger-ink on danger-subtle", fg: "var(--color-danger-ink)", bg: "var(--color-danger-subtle)", kind: "text" },
  { label: "Allergy pill icon (critical): danger-ink on danger-subtle", fg: "var(--color-danger-ink)", bg: "var(--color-danger-subtle)", kind: "ui" },
  { label: "Badge critical ring (2px): danger on danger-subtle", fg: "var(--color-danger)", bg: "var(--color-danger-subtle)", kind: "ui" },
  { label: "Badge critical ring (2px): danger on surface (hero)", fg: "var(--color-danger)", bg: "var(--color-surface)", kind: "ui" },
  { label: "SeverityTag warning (11px): warning on surface-pure", fg: "var(--color-warning)", bg: "var(--color-surface-pure)", kind: "text" },
  { label: "SeverityTag critical (11px): danger on surface-pure", fg: "var(--color-danger)", bg: "var(--color-surface-pure)", kind: "text" },
  { label: "SeverityTag critical outline: danger on surface (chart rows)", fg: "var(--color-danger)", bg: "var(--color-surface)", kind: "ui" },
  { label: "SeverityTag critical outline: danger on danger-subtle (E-Rx alert cards)", fg: "var(--color-danger)", bg: "var(--color-danger-subtle)", kind: "ui" },
  { label: "StatusDot critical: status-critical on surface", fg: "var(--color-status-critical)", bg: "var(--color-surface)", kind: "ui" },
  { label: "StatusDot warning: status-warning on surface", fg: "var(--color-status-warning)", bg: "var(--color-surface)", kind: "ui" },
  { label: "StatusDot stable: status-stable on surface", fg: "var(--color-status-stable)", bg: "var(--color-surface)", kind: "ui" },
  { label: "Cancel draft confirm: on-accent on danger", fg: "var(--color-on-accent)", bg: "var(--color-danger)", kind: "text" },
  { label: "Cancel draft confirm hover: on-accent on danger-ink", fg: "var(--color-on-accent)", bg: "var(--color-danger-ink)", kind: "text" },
  { label: "Form error text: warning on surface", fg: "var(--color-warning)", bg: "var(--color-surface)", kind: "text" },
  { label: "Form error text: warning on page", fg: "var(--color-warning)", bg: "var(--color-page)", kind: "text" },
  { label: "warning-stroke text on warning-subtle (not used for text)", fg: "var(--color-warning-stroke)", bg: "var(--color-warning-subtle)", kind: "text" },
  { label: "warning-stroke text on page (not used for text)", fg: "var(--color-warning-stroke)", bg: "var(--color-page)", kind: "text" },
  { label: "Error stroke vs warning-subtle (field inside advisory)", fg: "var(--color-warning-stroke)", bg: "var(--color-warning-subtle)", kind: "ui" },
  { label: "Error stroke vs danger-subtle (field inside blocking)", fg: "var(--color-warning-stroke)", bg: "var(--color-danger-subtle)", kind: "ui" },
  { label: "Blocking banner/card/tile title (12px+): danger-ink on danger-subtle", fg: "var(--color-danger-ink)", bg: "var(--color-danger-subtle)", kind: "text" },
  { label: "Blocking fill: ink on danger-subtle", fg: "var(--color-ink)", bg: "var(--color-danger-subtle)", kind: "text" },
  { label: "Blocking fill: danger icon on danger-subtle", fg: "var(--color-danger)", bg: "var(--color-danger-subtle)", kind: "ui" },
  { label: "Blocking fill: focus ring on danger-subtle", fg: "var(--color-focus)", bg: "var(--color-danger-subtle)", kind: "ui" },
  { label: "Blocking outline (2px): danger on danger-subtle", fg: "var(--color-danger)", bg: "var(--color-danger-subtle)", kind: "ui" },
  { label: "Blocking outline (2px): danger on surface", fg: "var(--color-danger)", bg: "var(--color-surface)", kind: "ui" },
  { label: "Blocking outline (2px): danger on page", fg: "var(--color-danger)", bg: "var(--color-page)", kind: "ui" },
  { label: "Blocking banner icon: danger on surface-pure", fg: "var(--color-danger)", bg: "var(--color-surface-pure)", kind: "ui" },
  { label: "Blocking banner icon ring: danger on danger-subtle", fg: "var(--color-danger)", bg: "var(--color-danger-subtle)", kind: "ui" },
  { label: "Blocking fill vs surface (alert inside a card)", fg: "var(--color-danger-subtle)", bg: "var(--color-surface)", kind: "decorative" },
  { label: "Banner body (blocking): ink-strong on danger-subtle", fg: "var(--color-ink-strong)", bg: "var(--color-danger-subtle)", kind: "text" },
  { label: "Advisory banner/card/tile title (12px+): warning on warning-subtle", fg: "var(--color-warning)", bg: "var(--color-warning-subtle)", kind: "text" },
  { label: "Advisory fill: warning icon on warning-subtle", fg: "var(--color-warning)", bg: "var(--color-warning-subtle)", kind: "ui" },
  { label: "Advisory fill: focus ring on warning-subtle", fg: "var(--color-focus)", bg: "var(--color-warning-subtle)", kind: "ui" },
  { label: "Advisory banner icon: warning on surface-pure", fg: "var(--color-warning)", bg: "var(--color-surface-pure)", kind: "ui" },
  { label: "Advisory outline (1px): warning-line on warning-subtle", fg: "var(--color-warning-line)", bg: "var(--color-warning-subtle)", kind: "decorative" },
  { label: "Advisory fill vs surface (alert inside a card)", fg: "var(--color-warning-subtle)", bg: "var(--color-surface)", kind: "decorative" },
  { label: "Banner body (advisory): ink-strong on warning-subtle", fg: "var(--color-ink-strong)", bg: "var(--color-warning-subtle)", kind: "text" },
  { label: "Attestation note: ink-strong on ok-subtle", fg: "var(--color-ink-strong)", bg: "var(--color-ok-subtle)", kind: "text" },
  { label: "Option note: ink-strong on accent-subtle", fg: "var(--color-ink-strong)", bg: "var(--color-accent-subtle)", kind: "text" },
  { label: "Suffix/placeholder on read-only: ink-secondary on surface-warm", fg: "var(--color-ink-secondary)", bg: "var(--color-surface-warm)", kind: "text" },
  { label: "Placeholder: ink-placeholder on surface", fg: "var(--color-ink-placeholder)", bg: "var(--color-surface)", kind: "text" },
  { label: "Success message: ok on surface", fg: "var(--color-ok)", bg: "var(--color-surface)", kind: "text" },
  { label: "Primary rest: page on ink", fg: "var(--color-page)", bg: "var(--color-ink)", kind: "text" },
  { label: "Primary hover: page on inverse-raised", fg: "var(--color-page)", bg: "var(--color-inverse-raised)", kind: "text" },
  { label: "Primary pressed: page on inverse-pressed", fg: "var(--color-page)", bg: "var(--color-inverse-pressed)", kind: "text" },
  { label: "Primary hover fill vs rest fill (change is visible; label text carries meaning)", fg: "var(--color-inverse-raised)", bg: "var(--color-ink)", kind: "decorative" },
  { label: "Secondary rest: ink on surface", fg: "var(--color-ink)", bg: "var(--color-surface)", kind: "text" },
  { label: "Secondary hover: ink on surface-pure", fg: "var(--color-ink)", bg: "var(--color-surface-pure)", kind: "text" },
  { label: "Secondary hover border: line-strong on page", fg: "var(--color-line-strong)", bg: "var(--color-page)", kind: "ui" },
  { label: "Secondary pressed: ink on surface-pressed", fg: "var(--color-ink)", bg: "var(--color-surface-pressed)", kind: "text" },
  { label: "Danger rest: on-accent on danger", fg: "var(--color-on-accent)", bg: "var(--color-danger)", kind: "text" },
  { label: "Danger hover: on-accent on danger-raised", fg: "var(--color-on-accent)", bg: "var(--color-danger-raised)", kind: "text" },
  { label: "Danger pressed: on-accent on danger-ink", fg: "var(--color-on-accent)", bg: "var(--color-danger-ink)", kind: "text" },
  { label: "Quiet hover: ink on surface-warm", fg: "var(--color-ink)", bg: "var(--color-surface-warm)", kind: "text" },
  { label: "Quiet pressed: ink on surface-pressed", fg: "var(--color-ink)", bg: "var(--color-surface-pressed)", kind: "text" },
  { label: "Link rest: accent on surface", fg: "var(--color-accent)", bg: "var(--color-surface)", kind: "text" },
  { label: "Link pressed: accent-pressed on surface", fg: "var(--color-accent-pressed)", bg: "var(--color-surface)", kind: "text" },
  { label: "Focus ring on page (unchanged on every button state)", fg: "var(--color-focus)", bg: "var(--color-page)", kind: "ui" },
  { label: "Quiet button: ink-secondary on surface", fg: "var(--color-ink-secondary)", bg: "var(--color-surface)", kind: "text" },
  { label: "NoAlert: ink-muted on page", fg: "var(--color-ink-muted)", bg: "var(--color-page)", kind: "text" },
  { label: "Avatar teal: on-accent on avatar-teal", fg: "var(--color-on-accent)", bg: "var(--color-avatar-teal)", kind: "text" },
  { label: "Avatar green: on-accent on avatar-green", fg: "var(--color-on-accent)", bg: "var(--color-avatar-green)", kind: "text" },
  { label: "Avatar blue: on-accent on avatar-blue", fg: "var(--color-on-accent)", bg: "var(--color-avatar-blue)", kind: "text" },
  { label: "Queue chip avatar slot 1 (11px initials): on-accent on queue-avatar-1", fg: "var(--color-on-accent)", bg: "var(--color-queue-avatar-1)", kind: "text" },
  { label: "Queue chip avatar slot 2 (11px initials): on-accent on queue-avatar-2", fg: "var(--color-on-accent)", bg: "var(--color-queue-avatar-2)", kind: "text" },
  { label: "Queue chip avatar slot 3 (11px initials): on-accent on queue-avatar-3", fg: "var(--color-on-accent)", bg: "var(--color-queue-avatar-3)", kind: "text" },
  { label: "Rail label: on-inverse-muted on inverse", fg: "var(--color-on-inverse-muted)", bg: "var(--color-inverse)", kind: "text" },
  { label: "Rail hover: on-inverse on inverse + 6% white", fg: "var(--color-on-inverse)", bg: "color-mix(in srgb, var(--color-on-inverse) 6%, var(--color-inverse))", kind: "text" },
  { label: "Rail current: on-inverse on inverse + 10% white", fg: "var(--color-on-inverse)", bg: "color-mix(in srgb, var(--color-on-inverse) 10%, var(--color-inverse))", kind: "text" },
  { label: "Rail focus outline: on-inverse on inverse", fg: "var(--color-on-inverse)", bg: "var(--color-inverse)", kind: "ui" },
  { label: "Theme focus ring on inverse (not used on the rail)", fg: "var(--color-focus)", bg: "var(--color-inverse)", kind: "ui" },
  { label: "Rail current marker: on-inverse on inverse", fg: "var(--color-on-inverse)", bg: "var(--color-inverse)", kind: "ui" },
  { label: "Rail current marker: on-inverse on inverse + 10% white", fg: "var(--color-on-inverse)", bg: "color-mix(in srgb, var(--color-on-inverse) 10%, var(--color-inverse))", kind: "ui" },
  { label: "Accent on inverse (not used for the rail marker)", fg: "var(--color-accent)", bg: "var(--color-inverse)", kind: "ui" },
  { label: "User menu trigger avatar: page on ink", fg: "var(--color-page)", bg: "var(--color-ink)", kind: "text" },
  { label: "User menu trigger role (11px): ink-secondary on page", fg: "var(--color-ink-secondary)", bg: "var(--color-page)", kind: "text" },
  { label: "User menu trigger role on hover: ink-secondary on surface-warm", fg: "var(--color-ink-secondary)", bg: "var(--color-surface-warm)", kind: "text" },
  { label: "User menu trigger hover: ink on surface-warm", fg: "var(--color-ink)", bg: "var(--color-surface-warm)", kind: "text" },
  { label: "User menu items (13px): ink on surface-pure", fg: "var(--color-ink)", bg: "var(--color-surface-pure)", kind: "text" },
  { label: "User menu focused item: ink on surface-warm", fg: "var(--color-ink)", bg: "var(--color-surface-warm)", kind: "text" },
  { label: "User menu group label (11px): ink-muted on surface-pure", fg: "var(--color-ink-muted)", bg: "var(--color-surface-pure)", kind: "text" },
  { label: "User menu checked mark: accent on surface-pure", fg: "var(--color-accent)", bg: "var(--color-surface-pure)", kind: "ui" },
  { label: "Queue chip name (12px): ink-strong on surface", fg: "var(--color-ink-strong)", bg: "var(--color-surface)", kind: "text" },
  { label: "Queue chip current (12px): ink on accent-subtle", fg: "var(--color-ink)", bg: "var(--color-accent-subtle)", kind: "text" },
  { label: "Queue chip current border: accent vs page", fg: "var(--color-accent)", bg: "var(--color-page)", kind: "ui" },
  { label: "Queue chip edge: line-subtle vs page (name carries the meaning)", fg: "var(--color-line-subtle)", bg: "var(--color-page)", kind: "decorative" },
  { label: "Queue status dot critical: status-critical on accent-subtle (current chip)", fg: "var(--color-status-critical)", bg: "var(--color-accent-subtle)", kind: "ui" },
  { label: "Queue status dot warning: status-warning on accent-subtle (current chip)", fg: "var(--color-status-warning)", bg: "var(--color-accent-subtle)", kind: "ui" },
  { label: "Queue status dot stable: status-stable on accent-subtle (current chip)", fg: "var(--color-status-stable)", bg: "var(--color-accent-subtle)", kind: "ui" },
  { label: "Queue View all (12px): accent on surface", fg: "var(--color-accent)", bg: "var(--color-surface)", kind: "text" },
  { label: "Queue label (11px): ink-muted on page", fg: "var(--color-ink-muted)", bg: "var(--color-page)", kind: "text" },
  { label: "Sync status (11px): ink-muted on page", fg: "var(--color-ink-muted)", bg: "var(--color-page)", kind: "text" },
  { label: "Sync status Offline (11px): danger on page", fg: "var(--color-danger)", bg: "var(--color-page)", kind: "text" },
  { label: "Sync dot online: status-stable on page", fg: "var(--color-status-stable)", bg: "var(--color-page)", kind: "ui" },
  { label: "Sync dot offline: status-critical on page", fg: "var(--color-status-critical)", bg: "var(--color-page)", kind: "ui" },
  { label: "Synthetic banner: warning on warning-subtle", fg: "var(--color-warning)", bg: "var(--color-warning-subtle)", kind: "text" },
  { label: "Chart allergy name (severe): danger-ink on surface", fg: "var(--color-danger-ink)", bg: "var(--color-surface)", kind: "text" },
  { label: "Chart allergy name (mild/moderate): warning on surface", fg: "var(--color-warning)", bg: "var(--color-surface)", kind: "text" },
  { label: "Chart allergy card icon (severe): danger on surface", fg: "var(--color-danger)", bg: "var(--color-surface)", kind: "ui" },
  { label: "Chart allergy card icon (mild/moderate): warning on surface", fg: "var(--color-warning)", bg: "var(--color-surface)", kind: "ui" },
  { label: "Chart allergy card outline (severe, 2px): danger on surface", fg: "var(--color-danger)", bg: "var(--color-surface)", kind: "ui" },
  { label: "Chart allergy card outline (severe, 2px): danger on page", fg: "var(--color-danger)", bg: "var(--color-page)", kind: "ui" },
  { label: "Chart allergy card outline (mild/moderate): warning-line on surface", fg: "var(--color-warning-line)", bg: "var(--color-surface)", kind: "decorative" },
  { label: "Chart allergy row divider (severe): danger-line on surface", fg: "var(--color-danger-line)", bg: "var(--color-surface)", kind: "decorative" },
  { label: "Chart allergy row divider (mild/moderate): warning-line on surface", fg: "var(--color-warning-line)", bg: "var(--color-surface)", kind: "decorative" },
  { label: "Chart banner Review draft link: page on ink (primary)", fg: "var(--color-page)", bg: "var(--color-ink)", kind: "text" },
  { label: "Chart banner Review draft link vs danger-subtle (primary edge)", fg: "var(--color-ink)", bg: "var(--color-danger-subtle)", kind: "ui" },
  { label: "Chart banner Review draft link vs warning-subtle (primary edge)", fg: "var(--color-ink)", bg: "var(--color-warning-subtle)", kind: "ui" },
  { label: "Chart hero meta and allergy reaction: ink-strong on surface", fg: "var(--color-ink-strong)", bg: "var(--color-surface)", kind: "text" },
  { label: "Chart medication dose and drug class: ink-muted on surface", fg: "var(--color-ink-muted)", bg: "var(--color-surface)", kind: "text" },
  { label: "Chart prescription link: accent on surface", fg: "var(--color-accent)", bg: "var(--color-surface)", kind: "text" },
  { label: "Chart status note: ink-secondary on surface", fg: "var(--color-ink-secondary)", bg: "var(--color-surface)", kind: "text" },
  { label: "Chart footer note: ink-muted on page", fg: "var(--color-ink-muted)", bg: "var(--color-page)", kind: "text" },
  { label: "Draft status badge (neutral): ink-secondary on surface-warm", fg: "var(--color-ink-secondary)", bg: "var(--color-surface-warm)", kind: "text" },
  { label: "E-Rx review title: on-inverse on inverse", fg: "var(--color-on-inverse)", bg: "var(--color-inverse)", kind: "text" },
  { label: "E-Rx review title focus outline (after an action): on-inverse on inverse", fg: "var(--color-on-inverse)", bg: "var(--color-inverse)", kind: "ui" },
  { label: "E-Rx review subtitle: on-inverse-muted on inverse", fg: "var(--color-on-inverse-muted)", bg: "var(--color-inverse)", kind: "text" },
  { label: "E-Rx review count (neutral): on-inverse on inverse + 12% white", fg: "var(--color-on-inverse)", bg: "color-mix(in srgb, var(--color-on-inverse) 12%, var(--color-inverse))", kind: "text" },
  { label: "E-Rx review count (all addressed): on-accent on ok", fg: "var(--color-on-accent)", bg: "var(--color-ok)", kind: "text" },
  { label: "E-Rx review count (advisory, 12px): warning on warning-subtle", fg: "var(--color-warning)", bg: "var(--color-warning-subtle)", kind: "text" },
  { label: "E-Rx review count (blocking, 12px): danger-ink on danger-subtle", fg: "var(--color-danger-ink)", bg: "var(--color-danger-subtle)", kind: "text" },
  { label: "E-Rx review count blocking outline (2px): danger on danger-subtle (inner edge)", fg: "var(--color-danger)", bg: "var(--color-danger-subtle)", kind: "ui" },
  { label: "E-Rx review count blocking outline vs inverse header (not used as the boundary; the light fill is)", fg: "var(--color-danger)", bg: "var(--color-inverse)", kind: "ui" },
  { label: "E-Rx review count fill vs inverse header (blocking)", fg: "var(--color-danger-subtle)", bg: "var(--color-inverse)", kind: "ui" },
  { label: "E-Rx review count fill vs inverse header (advisory)", fg: "var(--color-warning-subtle)", bg: "var(--color-inverse)", kind: "ui" },
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
  { label: "E-Rx blocking card link: accent on danger-subtle", fg: "var(--color-accent)", bg: "var(--color-danger-subtle)", kind: "text" },
  { label: "E-Rx alert card guidance (blocking): ink-strong on danger-subtle", fg: "var(--color-ink-strong)", bg: "var(--color-danger-subtle)", kind: "text" },
  { label: "E-Rx alert card guidance (advisory): ink-strong on warning-subtle", fg: "var(--color-ink-strong)", bg: "var(--color-warning-subtle)", kind: "text" },
  { label: "E-Rx severe allergy tile and blocking summary: danger-ink on danger-subtle", fg: "var(--color-danger-ink)", bg: "var(--color-danger-subtle)", kind: "text" },
  { label: "E-Rx moderate allergy tile and advisory summary: warning on warning-subtle", fg: "var(--color-warning)", bg: "var(--color-warning-subtle)", kind: "text" },
  { label: "E-Rx neutral tile: ink-strong on surface-warm", fg: "var(--color-ink-strong)", bg: "var(--color-surface-warm)", kind: "text" },
  { label: "E-Rx label preview text: ok on surface", fg: "var(--color-ok)", bg: "var(--color-surface)", kind: "text" },
];

const DEMO_TONES = queueAvatarTones(DEMO_QUEUE);

/** The hover and pressed classes from `button.tsx`, applied without the pseudo-class for the specimen. */
const STATE_PREVIEW = {
  primary: { rest: "", hover: "border-inverse-raised bg-inverse-raised shadow-level-1", pressed: "border-inverse-pressed bg-inverse-pressed" },
  secondary: { rest: "", hover: "border-line-strong bg-surface-pure shadow-level-1", pressed: "bg-surface-pressed" },
  danger: { rest: "", hover: "border-danger-raised bg-danger-raised shadow-level-1", pressed: "border-danger-ink bg-danger-ink" },
  quiet: { rest: "", hover: "bg-surface-warm text-ink shadow-level-1", pressed: "bg-surface-pressed" },
  link: { rest: "", hover: "underline", pressed: "text-accent-pressed" },
} as const;

const ICONS = {
  SearchIcon,
  LockIcon,
  CloseIcon,
  AlertTriangleIcon,
  InfoIcon,
  ChevronDownIcon,
  CalendarIcon,
  ClockIcon,
  PillIcon,
  CheckIcon,
  CheckCircleIcon,
  ChartIcon,
  RxIcon,
  FlaskIcon,
  BillingIcon,
  EyeIcon,
  EyeOffIcon,
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
              <a href="#buttons" className={buttonStyles({ size: "sm" })} data-testid="button-link-specimen">
                New prescription draft
              </a>
            </div>
            <div>
              <Label>states (static previews of hover and pressed; hover, press or Tab the live buttons above)</Label>
              <div className="flex flex-col gap-3">
                {(["primary", "secondary", "danger", "quiet", "link"] as const).map((variant) => (
                  <div key={variant} className="flex flex-wrap items-center gap-3" data-testid={`button-states-${variant}`}>
                    {(["rest", "hover", "pressed"] as const).map((state) => (
                      <span key={state} aria-hidden="true" className={buttonStyles({ variant, size: "sm", className: STATE_PREVIEW[variant][state] })}>
                        {variant} {state}
                      </span>
                    ))}
                    <Button variant={variant} size="sm">
                      {variant} live
                    </Button>
                    <Button variant={variant} size="sm" disabled>
                      {variant} disabled
                    </Button>
                  </div>
                ))}
              </div>
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
            <div className="flex flex-wrap items-center gap-2">
              <Label>Badge size md (hero allergy pill)</Label>
              <Badge tone="critical" size="md">
                <AlertTriangleIcon className="size-3.5" />1 allergy · severe
              </Badge>
              <Badge tone="warning" size="md">
                <AlertTriangleIcon className="size-3.5" />2 allergies · highest moderate
              </Badge>
              <Badge tone="neutral" size="md">
                No active allergies recorded
              </Badge>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Label>PatientQueueItem</Label>
              <ul className="flex flex-wrap gap-2">
                {DEMO_QUEUE.slice(0, 3).map((patient, index) => (
                  <li key={patient.id}>
                    <PatientQueueItem
                      patient={patient}
                      avatarTone={DEMO_TONES.get(patient.id)}
                      current={index === 0 ? "page" : undefined}
                    />
                  </li>
                ))}
              </ul>
            </div>
            <p className="text-label-sm text-ink-strong">
              Severe and critical use the red (danger) tokens; moderate and warning use orange; stable uses green.
              Blocking also has the emphasis border width, its label and comes first. Every severity uses the
              triangle icon; status dots stay dots.
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
                <PanelTitle icon={<AlertTriangleIcon />} tone="critical">
                  Allergies
                </PanelTitle>
                <p className="mt-2 text-body-sm text-ink-strong">
                  Critical-tone card: blocking emphasis outline (2px danger) and the triangle icon in danger.
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
                <Avatar initials="RT" tone="teal" size="xs" />
                <Avatar initials="RT" tone="teal" size="sm" />
                <Avatar initials="RT" tone="teal" />
                <Avatar initials="MG" tone="green" />
                <Avatar initials="QX" size="lg" />
              </div>
              <div className="flex items-center gap-3" data-specimen="queue-avatars">
                <span className="text-label-sm text-ink-secondary">Queue chip palette (decorative):</span>
                {QUEUE_AVATAR_TONES.map((tone, i) => (
                  <Avatar key={tone} initials={["RT", "MD", "JF"][i]} tone={tone} size="xs" />
                ))}
                {QUEUE_AVATAR_TONES.map((tone) => (
                  <Avatar key={`masked-${tone}`} initials="••" tone={tone} size="xs" />
                ))}
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
