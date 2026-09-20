import { useId, type ReactNode } from "react";
import { Check, Lock, Minus, Plus } from "lucide-react";
import { Chip, Field, Input, Select, Textarea } from "@/components/ui";
import { cn } from "@/lib/cn";
import { CREDIT_LABEL, GOAL_LABEL, INCOME_LABEL } from "@/lib/format";
import { TagInput } from "./TagInput";
import {
  CREDIT_BANDS,
  GOAL_OPTIONS,
  INCOME_BANDS,
  LEASE_TERMS,
  LIMITS,
  MUST_HAVE_OPTIONS,
  todayIso,
  type CreditBand,
  type DraftChange,
  type DraftErrors,
  type IncomeBand,
  type ProfileDraft,
} from "./profileDraft";

/*
 * The profile form, in groups. Onboarding lays the groups out as three steps;
 * the Passport editor lays the same groups out as sections of one page.
 */

interface GroupProps {
  draft: ProfileDraft;
  errors: DraftErrors;
  onChange: DraftChange;
}

// Small controls -----------------------------------------------------------------

/** A labelled set of controls that is not a single input: chips, segmented choices. */
function Group({
  legend,
  hint,
  error,
  children,
  className,
}: {
  legend: string;
  hint?: ReactNode;
  error?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <fieldset className={cn("min-w-0 space-y-2", className)}>
      <legend className="text-sm font-medium text-ink">{legend}</legend>
      {children}
      {error ? (
        <p className="text-xs text-clay-deep">{error}</p>
      ) : (
        hint && <p className="text-xs text-ink-faint">{hint}</p>
      )}
    </fieldset>
  );
}

function Segmented<T extends string | number | boolean>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: ReadonlyArray<{ value: T; label: string }>;
  onChange: (value: T) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="inline-flex max-w-full flex-wrap gap-1 rounded-xl border border-line-strong bg-paper-deep/60 p-1"
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={String(option.value)}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              "min-w-11 cursor-pointer rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
              selected ? "bg-forest text-paper shadow-sm" : "text-ink-soft hover:bg-card hover:text-ink",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function Stepper({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  const button =
    "flex size-10 cursor-pointer items-center justify-center text-ink-soft transition-colors hover:bg-paper-deep hover:text-ink disabled:cursor-not-allowed disabled:opacity-40";
  return (
    <div
      role="group"
      aria-label={label}
      className="inline-flex items-center overflow-hidden rounded-xl border border-line-strong bg-card"
    >
      <button
        type="button"
        className={button}
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        aria-label={`One fewer: ${label}`}
      >
        <Minus className="size-4" aria-hidden="true" />
      </button>
      <span aria-live="polite" className="w-10 text-center text-sm font-semibold tabular-nums text-ink">
        {value}
      </span>
      <button
        type="button"
        className={button}
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        aria-label={`One more: ${label}`}
      >
        <Plus className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}

/** Marks a field as something Nestor keeps to itself. */
export function PrivateNote({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-start gap-1.5">
      <Lock className="mt-px size-3 shrink-0 text-moss" aria-hidden="true" />
      <span>{children}</span>
    </span>
  );
}

function CharCount({ value, max }: { value: string; max: number }) {
  const length = value.trim().length;
  return (
    <span className={cn("tabular-nums", length > max ? "text-clay-deep" : "text-ink-faint")}>
      {length}/{max}
    </span>
  );
}

const YES_NO = [
  { value: true, label: "Yes" },
  { value: false, label: "No" },
] as const;

const BEDROOM_OPTIONS = [
  { value: 0, label: "Studio" },
  { value: 1, label: "1" },
  { value: 2, label: "2" },
  { value: 3, label: "3" },
  { value: 4, label: "4+" },
];

// Field groups -------------------------------------------------------------------

export function NameField({ draft, errors, onChange }: GroupProps) {
  const id = useId();
  return (
    <Field
      label="Your name"
      htmlFor={id}
      error={errors.displayName}
      hint="As a landlord should see it. Nestor signs emails on your behalf with this name."
    >
      <Input
        id={id}
        value={draft.displayName}
        onChange={(event) => onChange({ displayName: event.target.value })}
        placeholder="Maya Okafor"
        autoComplete="name"
        maxLength={LIMITS.name}
        aria-invalid={errors.displayName ? true : undefined}
      />
    </Field>
  );
}

export function SearchFields({ draft, errors, onChange }: GroupProps) {
  const id = useId();
  const presetKeys = new Set(MUST_HAVE_OPTIONS.map((option) => option.toLowerCase()));
  const hasMustHave = (option: string) =>
    draft.mustHaves.some((value) => value.toLowerCase() === option.toLowerCase());

  function toggleMustHave(option: string) {
    onChange({
      mustHaves: hasMustHave(option)
        ? draft.mustHaves.filter((value) => value.toLowerCase() !== option.toLowerCase())
        : [...draft.mustHaves, option],
    });
  }

  return (
    <div className="space-y-6">
      <Field label="City" htmlFor={`${id}-city`} error={errors.city}>
        <Input
          id={`${id}-city`}
          value={draft.city}
          onChange={(event) => onChange({ city: event.target.value })}
          placeholder="Chicago, IL"
          autoComplete="address-level2"
          maxLength={LIMITS.city}
          aria-invalid={errors.city ? true : undefined}
        />
      </Field>

      <Field
        label="Neighborhoods you like"
        htmlFor={`${id}-hoods`}
        error={errors.neighborhoods}
        hint="Optional. Press Enter after each one. Listings there score higher."
      >
        <TagInput
          id={`${id}-hoods`}
          values={draft.neighborhoods}
          onChange={(neighborhoods) => onChange({ neighborhoods })}
          placeholder="Logan Square"
          addLabel="Add neighborhood"
        />
      </Field>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          label="Most you can pay each month"
          htmlFor={`${id}-max`}
          error={errors.budgetMax}
        >
          <div className="relative">
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-ink-faint">
              $
            </span>
            <Input
              id={`${id}-max`}
              value={draft.budgetMax}
              onChange={(event) => onChange({ budgetMax: event.target.value })}
              inputMode="numeric"
              placeholder="2000"
              className="pl-7"
              aria-invalid={errors.budgetMax ? true : undefined}
            />
          </div>
        </Field>
        <Field label="Least you expect to pay (optional)" htmlFor={`${id}-min`} error={errors.budgetMin}>
          <div className="relative">
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-ink-faint">
              $
            </span>
            <Input
              id={`${id}-min`}
              value={draft.budgetMin}
              onChange={(event) => onChange({ budgetMin: event.target.value })}
              inputMode="numeric"
              placeholder="1400"
              className="pl-7"
              aria-invalid={errors.budgetMin ? true : undefined}
            />
          </div>
        </Field>
        <p className="text-xs leading-relaxed text-ink-soft sm:col-span-2">
          <PrivateNote>
            Your budget is private. Nestor uses it to score listings and never puts it in an email,
            on your Passport, or anywhere a landlord can see.
          </PrivateNote>
        </p>
      </div>

      <Group legend="Bedrooms, at least">
        <Segmented
          label="Bedrooms, at least"
          value={Math.min(draft.bedroomsMin, 4)}
          options={BEDROOM_OPTIONS}
          onChange={(bedroomsMin) => onChange({ bedroomsMin })}
        />
      </Group>

      <Group
        legend="Must-haves"
        error={errors.mustHaves}
        hint="Optional. The Scout checks each listing's amenities against these."
      >
        <div className="flex flex-wrap gap-2">
          {MUST_HAVE_OPTIONS.map((option) => (
            <Chip key={option} selected={hasMustHave(option)} onClick={() => toggleMustHave(option)}>
              {option}
            </Chip>
          ))}
        </div>
        <label htmlFor={`${id}-must`} className="sr-only">
          Add your own must-have
        </label>
        <TagInput
          id={`${id}-must`}
          values={draft.mustHaves}
          onChange={(mustHaves) => onChange({ mustHaves })}
          placeholder="Something else, like a south-facing window"
          addLabel="Add must-have"
          hidden={(value) => presetKeys.has(value.toLowerCase())}
        />
      </Group>
    </div>
  );
}

export function TimingFields({ draft, errors, onChange }: GroupProps) {
  const id = useId();
  const stored = Number(draft.leaseTermMonths);
  const terms =
    draft.leaseTermMonths !== "" && !LEASE_TERMS.includes(stored)
      ? [...LEASE_TERMS, stored].sort((a, b) => a - b)
      : LEASE_TERMS;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Field
        label="Move-in date"
        htmlFor={`${id}-move`}
        error={errors.moveInDate}
        hint="Leave empty if you are flexible."
      >
        <Input
          id={`${id}-move`}
          type="date"
          value={draft.moveInDate}
          min={todayIso()}
          onChange={(event) => onChange({ moveInDate: event.target.value })}
          aria-invalid={errors.moveInDate ? true : undefined}
        />
      </Field>
      <Field label="Lease length" htmlFor={`${id}-term`}>
        <Select
          id={`${id}-term`}
          value={draft.leaseTermMonths}
          onChange={(event) => onChange({ leaseTermMonths: event.target.value })}
        >
          <option value="">Flexible</option>
          {terms.map((months) => (
            <option key={months} value={String(months)}>
              {months} months
            </option>
          ))}
        </Select>
      </Field>
    </div>
  );
}

export function AboutFields({ draft, errors, onChange }: GroupProps) {
  const id = useId();
  return (
    <div className="space-y-5">
      <Field
        label="One-line introduction"
        htmlFor={`${id}-headline`}
        error={errors.headline}
        hint="Optional. The first thing a landlord reads under your name."
      >
        <Input
          id={`${id}-headline`}
          value={draft.headline}
          onChange={(event) => onChange({ headline: event.target.value })}
          placeholder="Product designer relocating for work, quiet and tidy"
          maxLength={LIMITS.headline}
          aria-invalid={errors.headline ? true : undefined}
        />
      </Field>
      <Field label="What you do" htmlFor={`${id}-occupation`} error={errors.occupation} hint="Optional.">
        <Input
          id={`${id}-occupation`}
          value={draft.occupation}
          onChange={(event) => onChange({ occupation: event.target.value })}
          placeholder="Product designer"
          autoComplete="organization-title"
          maxLength={LIMITS.occupation}
          aria-invalid={errors.occupation ? true : undefined}
        />
      </Field>
      <Field label="A few words to landlords" htmlFor={`${id}-bio`} error={errors.bio}>
        <Textarea
          id={`${id}-bio`}
          value={draft.bio}
          onChange={(event) => onChange({ bio: event.target.value })}
          rows={4}
          placeholder="Why you are moving, how long you plan to stay, what kind of neighbour you are."
          aria-invalid={errors.bio ? true : undefined}
        />
        <p className="flex justify-between gap-3 text-xs text-ink-faint">
          <span>Optional. Shown on your Passport in your own words.</span>
          <CharCount value={draft.bio} max={LIMITS.bio} />
        </p>
      </Field>
    </div>
  );
}

export function HouseholdFields({ draft, errors, onChange }: GroupProps) {
  const id = useId();
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Group legend="People moving in" hint="Including you.">
          <Stepper
            label="People moving in"
            value={draft.occupants}
            min={1}
            max={10}
            onChange={(occupants) => onChange({ occupants })}
          />
        </Group>
        <Group legend="Any pets?">
          <Segmented
            label="Any pets?"
            value={draft.hasPets}
            options={YES_NO}
            onChange={(hasPets) => onChange({ hasPets })}
          />
        </Group>
      </div>

      {draft.hasPets && (
        <Field
          label="Tell landlords about them"
          htmlFor={`${id}-pets`}
          error={errors.petDescription}
          hint="Species, size and temperament answer most landlords' first question."
          className="animate-rise"
        >
          <Input
            id={`${id}-pets`}
            value={draft.petDescription}
            onChange={(event) => onChange({ petDescription: event.target.value })}
            placeholder="One 30 lb beagle, house-trained"
            maxLength={LIMITS.petDescription}
            aria-invalid={errors.petDescription ? true : undefined}
          />
        </Field>
      )}

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Group legend="Do you smoke?">
          <Segmented
            label="Do you smoke?"
            value={draft.smoker}
            options={YES_NO}
            onChange={(smoker) => onChange({ smoker })}
          />
        </Group>
        <Group legend="Rented before?">
          <Segmented
            label="Rented before?"
            value={draft.hasRentalHistory}
            options={YES_NO}
            onChange={(hasRentalHistory) => onChange({ hasRentalHistory })}
          />
        </Group>
      </div>
    </div>
  );
}

export function FinancialFields({ draft, onChange }: GroupProps) {
  const id = useId();
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Credit score range" htmlFor={`${id}-credit`}>
          <Select
            id={`${id}-credit`}
            value={draft.creditBand}
            onChange={(event) => onChange({ creditBand: event.target.value as CreditBand })}
          >
            {CREDIT_BANDS.map((band) => (
              <option key={band} value={band}>
                {CREDIT_LABEL[band]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Household income range" htmlFor={`${id}-income`}>
          <Select
            id={`${id}-income`}
            value={draft.incomeBand}
            onChange={(event) => onChange({ incomeBand: event.target.value as IncomeBand })}
          >
            {INCOME_BANDS.map((band) => (
              <option key={band} value={band}>
                {INCOME_LABEL[band]}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <p className="text-xs leading-relaxed text-ink-soft">
        Ranges only. Nestor never asks for a credit report, a pay stub or a bank statement, and the
        Passport tells landlords these facts are self-reported.
      </p>
    </div>
  );
}

export function GoalFields({ draft, onChange }: GroupProps) {
  function toggle(goal: ProfileDraft["negotiationGoals"][number]) {
    onChange({
      negotiationGoals: draft.negotiationGoals.includes(goal)
        ? draft.negotiationGoals.filter((item) => item !== goal)
        : [...draft.negotiationGoals, goal],
    });
  }

  return (
    <fieldset className="min-w-0">
      <legend className="sr-only">What Nestor should negotiate</legend>
      <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {GOAL_OPTIONS.map(({ goal, hint }) => {
          const selected = draft.negotiationGoals.includes(goal);
          return (
            <li key={goal}>
              <button
                type="button"
                aria-pressed={selected}
                onClick={() => toggle(goal)}
                className={cn(
                  "flex h-full w-full cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 text-left transition-colors",
                  selected
                    ? "border-forest bg-forest-soft"
                    : "border-line-strong bg-card hover:border-forest",
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md border transition-colors",
                    selected ? "border-forest bg-forest text-paper" : "border-line-strong bg-card",
                  )}
                >
                  {selected && <Check className="size-3.5" />}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-ink">{GOAL_LABEL[goal]}</span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-ink-soft">{hint}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </fieldset>
  );
}
