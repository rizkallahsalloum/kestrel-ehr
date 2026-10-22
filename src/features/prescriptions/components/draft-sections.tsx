"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Button,
  CheckIcon,
  cn,
  Combobox,
  FormField,
  FormMessage,
  PrivateField,
  PrivateText,
  SelectInput,
  TextArea,
  TextInput,
  type ComboboxOption,
} from "@/components/ui";
import type { MedicationOption } from "@/types/domain";
import type { PrescriptionFormValues } from "../form-values";
import { DOSE_UNITS, FREQUENCIES, ROUTES, START_DATE_WINDOW_DAYS, todayUtc } from "../schemas";
import { calculatedDays, FREQUENCY_WORDING, ROUTE_WORDING, sigSentence } from "../sig";
import type { TrackerStep } from "../workspace";

type FieldErrors = Partial<Record<string, string[]>>;
type Bind = (name: keyof PrescriptionFormValues) => {
  name: string;
  value: string;
  onChange: (event: { target: { value: string } }) => void;
};

function Section({ id, title, note, children }: { id: string; title: string; note: string; children: ReactNode }) {
  return (
    <section
      id={id}
      tabIndex={-1}
      aria-labelledby={`${id}-title`}
      className="rounded-card border border-line-subtle bg-surface px-5 py-4"
    >
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h2 id={`${id}-title`} className="text-heading-sm font-semibold text-ink">
          {title}
        </h2>
        <span className="text-label-sm text-ink-muted">{note}</span>
      </div>
      {children}
    </section>
  );
}

/** E-Rx `.track`: anchor links with done checks, computed from form state on the client. */
export function SectionTracker({ steps }: { steps: TrackerStep[] }) {
  return (
    <nav aria-label="Prescription sections" className="@container rounded-card border border-line-subtle bg-surface px-3.5 py-2.5">
      <ol className="flex flex-col gap-2 @tracker-row:flex-row @tracker-row:gap-1">
        {steps.map((step, index) => (
          <li key={step.id} className="@tracker-row:flex-auto">
            <a
              href={`#${step.id}`}
              className={cn(
                "flex min-h-9 items-center gap-2 rounded-control px-2 text-label hover:bg-surface-warm",
                step.done ? "text-ink" : "text-ink-strong",
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "grid size-5.5 shrink-0 place-items-center rounded-full border-(length:--border-width-field) text-label-sm",
                  step.done ? "border-ok bg-ok text-on-accent" : "border-line-field",
                )}
              >
                {step.done ? <CheckIcon className="size-3.5" /> : index + 1}
              </span>
              {step.shortLabel ? (
                <>
                  <span aria-hidden="true" className="whitespace-nowrap @max-tracker-row:hidden @tracker-full:hidden">
                    {step.shortLabel}
                  </span>
                  <span className="sr-only @max-tracker-row:not-sr-only @tracker-full:not-sr-only @tracker-full:whitespace-nowrap">
                    {step.label}
                  </span>
                </>
              ) : (
                <span className="whitespace-nowrap">{step.label}</span>
              )}
              <span className="sr-only">{step.done ? " (complete)" : " (not complete)"}</span>
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

function optionFor(m: MedicationOption): ComboboxOption {
  return { value: m.id, label: `${m.name} ${m.strength} ${m.form}`, description: "Synthetic catalog", meta: m.drug_class_code };
}

export function MedicationSection({
  medications,
  value,
  onChange,
  errors,
}: {
  medications: MedicationOption[];
  value: string;
  onChange: (value: string) => void;
  errors?: string[];
}) {
  const selected = medications.find((m) => m.id === value) ?? null;
  const [changing, setChanging] = useState(false);
  const showPicker = !selected || changing || Boolean(errors?.length);
  const changeRef = useRef<HTMLButtonElement>(null);
  const focusTarget = useRef<"picker" | "change" | null>(null);

  useEffect(() => {
    if (focusTarget.current === "picker") document.getElementById("medicationId")?.focus();
    if (focusTarget.current === "change") changeRef.current?.focus();
    focusTarget.current = null;
  }, [showPicker]);

  return (
    <Section id="rx-medication" title="Medication" note="Required">
      <input type="hidden" name="medicationId" value={value} />
      {showPicker ? (
        <FormField
          id="medicationId"
          label="Medication (synthetic catalog)"
          required
          helper="Fictional medications only. Type to filter."
          errors={errors}
        >
          <PrivateField label="Medication">
            <Combobox
              options={medications.map(optionFor)}
              value={value || null}
              onValueChange={(next) => {
                onChange(next ?? "");
                if (next) {
                  focusTarget.current = "change";
                  setChanging(false);
                }
              }}
              placeholder="Search the synthetic catalog"
              size="lg"
            />
          </PrivateField>
        </FormField>
      ) : (
        <div className="flex flex-wrap items-center gap-2.5 rounded-panel border border-accent bg-accent-subtle px-3.5 py-2.5">
          <div className="min-w-0 flex-1">
            <p className="text-label font-semibold text-ink">
              <PrivateText label="Medication">{`${selected.name} ${selected.strength} ${selected.form}`}</PrivateText>
            </p>
            <p className="text-label-sm text-ink-strong">Synthetic catalog</p>
          </div>
          <span className="rounded-pill bg-surface-pure px-2.5 py-0.5 font-mono text-label-sm text-ink-strong">
            <PrivateText label="Drug class">{selected.drug_class_code}</PrivateText>
          </span>
          <Button
            ref={changeRef}
            variant="link"
            size="sm"
            onClick={() => {
              focusTarget.current = "picker";
              setChanging(true);
            }}
          >
            Change<span className="sr-only"> medication</span>
          </Button>
        </div>
      )}
      <div className="mt-3.5 grid gap-3 @fields-2:grid-cols-2">
        <FormField id="rx-strength" label="Strength" helper="From the catalog">
          <PrivateField label="Strength">
            <TextInput readOnly value={selected?.strength ?? ""} />
          </PrivateField>
        </FormField>
        <FormField id="rx-form" label="Dose form" helper="From the catalog">
          <PrivateField label="Dose form">
            <TextInput readOnly value={selected?.form ?? ""} />
          </PrivateField>
        </FormField>
      </div>
    </Section>
  );
}

const sentenceControl =
  "min-h-9 rounded-control border-(length:--border-width-field) border-line-field bg-surface px-2 font-medium text-ink aria-invalid:border-warning-stroke";

function dateOffset(days: number): string {
  const today = new Date(`${todayUtc()}T00:00:00Z`);
  today.setUTCDate(today.getUTCDate() + days);
  return today.toISOString().slice(0, 10);
}

export function DirectionsSection({
  values,
  bind,
  errors,
}: {
  values: PrescriptionFormValues;
  bind: Bind;
  errors: FieldErrors;
}) {
  const sentence = sigSentence(values);
  const days = calculatedDays(values);
  const sigFields = ["doseAmount", "doseUnit", "route", "frequency"] as const;
  const sigErrors = sigFields.filter((field) => errors[field]?.length);
  const describe = (field: (typeof sigFields)[number]) =>
    cn("rx-label-preview", Boolean(errors[field]?.length) && `${field}-message`);

  return (
    <Section id="rx-directions" title="Directions and supply" note="Structured directions">
      <fieldset>
        <legend className="mb-1 text-label font-medium text-ink-strong">
          Dosage directions
          <span aria-hidden="true" className="text-ink-muted">
            {" "}
            *
          </span>
        </legend>
        <PrivateField label="Dosage directions">
          <div className="flex flex-wrap items-center gap-2 rounded-control border border-line px-3 py-2 text-body">
            <span aria-hidden="true" className="font-medium text-ink-strong">
              {ROUTE_WORDING[values.route as keyof typeof ROUTE_WORDING]?.verb ?? "Take"}
            </span>
            <label htmlFor="doseAmount" className="sr-only">
              Dose amount
            </label>
            <input
              {...bind("doseAmount")}
              id="doseAmount"
              type="number"
              inputMode="decimal"
              min="0"
              step="any"
              placeholder="Dose"
              aria-required
              aria-invalid={Boolean(errors.doseAmount?.length) || undefined}
              aria-describedby={describe("doseAmount")}
              className={cn(sentenceControl, "w-24 placeholder:font-normal placeholder:text-ink-placeholder")}
            />
            <label htmlFor="doseUnit" className="sr-only">
              Dose unit
            </label>
            <select
              {...bind("doseUnit")}
              id="doseUnit"
              aria-invalid={Boolean(errors.doseUnit?.length) || undefined}
              aria-describedby={describe("doseUnit")}
              className={sentenceControl}
            >
              {DOSE_UNITS.map((unit) => (
                <option key={unit} value={unit}>
                  {unit}
                </option>
              ))}
            </select>
            <label htmlFor="route" className="sr-only">
              Route
            </label>
            <select
              {...bind("route")}
              id="route"
              aria-invalid={Boolean(errors.route?.length) || undefined}
              aria-describedby={describe("route")}
              className={sentenceControl}
            >
              {ROUTES.map((route) => (
                <option key={route} value={route}>
                  {ROUTE_WORDING[route].phrase}
                </option>
              ))}
            </select>
            <label htmlFor="frequency" className="sr-only">
              Frequency
            </label>
            <select
              {...bind("frequency")}
              id="frequency"
              aria-invalid={Boolean(errors.frequency?.length) || undefined}
              aria-describedby={describe("frequency")}
              className={sentenceControl}
            >
              {FREQUENCIES.map((frequency) => (
                <option key={frequency} value={frequency}>
                  {FREQUENCY_WORDING[frequency]}
                </option>
              ))}
            </select>
          </div>
        </PrivateField>
      </fieldset>
      {sigErrors.map((field) => (
        <FormMessage key={field} id={`${field}-message`} tone="error" className="mt-1.5">
          {errors[field]!.join(" ")}
        </FormMessage>
      ))}
      <p id="rx-label-preview" className="mt-1.5 text-label text-ok">
        Label preview:{" "}
        {sentence ? <PrivateText label="Directions">{sentence}</PrivateText> : "enter a dose amount to see the directions."}
      </p>

      <div className="mt-3.5 grid gap-3 @fields-2:grid-cols-2 @fields-4:grid-cols-4">
        <FormField id="quantity" label="Quantity" required errors={errors.quantity}>
          <PrivateField label="Quantity">
            <TextInput {...bind("quantity")} type="number" inputMode="numeric" min="1" step="1" />
          </PrivateField>
        </FormField>
        <FormField id="refills" label="Refills" helper="0 to 5" errors={errors.refills}>
          <PrivateField label="Refills">
            <SelectInput {...bind("refills")}>
              {[0, 1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={String(n)}>
                  {n}
                </option>
              ))}
            </SelectInput>
          </PrivateField>
        </FormField>
        <FormField
          id="durationDays"
          label="Duration in days (optional)"
          helper={days ? `About ${days} days at this dose.` : "Optional."}
          errors={errors.durationDays}
        >
          <PrivateField label="Duration in days">
            <TextInput {...bind("durationDays")} type="number" inputMode="numeric" min="1" step="1" />
          </PrivateField>
        </FormField>
        <FormField
          id="startDate"
          label="Start date"
          required
          helper={`Within ${START_DATE_WINDOW_DAYS} days of today.`}
          errors={errors.startDate}
        >
          <PrivateField label="Start date">
            <TextInput
              {...bind("startDate")}
              type="date"
              min={dateOffset(-START_DATE_WINDOW_DAYS)}
              max={dateOffset(START_DATE_WINDOW_DAYS)}
            />
          </PrivateField>
        </FormField>
      </div>
    </Section>
  );
}

export function InstructionsSection({ bind, errors }: { bind: Bind; errors: FieldErrors }) {
  return (
    <Section id="rx-instructions" title="Instructions" note="Optional">
      <FormField
        id="instructions"
        label="Instructions (optional)"
        helper="Shown in the label preview. Nothing is sent to a pharmacy."
        errors={errors.instructions}
      >
        <PrivateField label="Instructions">
          <TextArea {...bind("instructions")} rows={3} maxLength={500} />
        </PrivateField>
      </FormField>
    </Section>
  );
}
