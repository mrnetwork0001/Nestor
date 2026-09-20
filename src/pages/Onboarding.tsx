import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { ArrowLeft, ArrowRight, Check, Lock, MailCheck, ScanSearch, ShieldCheck } from "@/components/icons";
import { Navigate, useNavigate } from "react-router";
import { toast } from "sonner";
import { api } from "../../convex/_generated/api";
import { Logo } from "@/components/Logo";
import { SignOutButton } from "@/components/SignOutControl";
import { Eyebrow } from "@/components/landing/Motif";
import { useDocumentTitle } from "@/components/landing/useDocumentTitle";
import {
  AboutFields,
  FinancialFields,
  GoalFields,
  HouseholdFields,
  NameField,
  SearchFields,
  TimingFields,
} from "@/components/onboarding/ProfileFields";
import {
  emptyDraft,
  errorsForStep,
  firstStepWithErrors,
  passportFromDraft,
  toSaveArgs,
  validateDraft,
  type DraftStep,
  type ProfileDraft,
} from "@/components/onboarding/profileDraft";
import { PassportCard } from "@/components/passport/PassportCard";
import { Button, Callout, PageLoader } from "@/components/ui";
import { errorSentence } from "@/lib/errors";
import { cn } from "@/lib/cn";

const STEPS: ReadonlyArray<{ step: DraftStep; label: string; title: string; lede: string }> = [
  {
    step: 1,
    label: "You and your search",
    title: "First, what are you looking for?",
    lede: "The Scout scores every listing against this, so you see the good ones first.",
  },
  {
    step: 2,
    label: "Your Passport facts",
    title: "Now, what should a landlord know?",
    lede: "These facts become your Renter Passport: one page Nestor links in its first email, so landlords can say yes faster.",
  },
  {
    step: 3,
    label: "What to negotiate",
    title: "Last, what should Nestor ask for?",
    lede: "Pick what matters to you. The Negotiator asks for at most two things per email, and only when the listing gives it a reason.",
  },
];

function AsidePoint({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-forest-soft text-forest">
        {icon}
      </span>
      <div>
        <p className="text-sm font-semibold text-ink">{title}</p>
        <p className="mt-0.5 text-sm leading-relaxed text-ink-soft">{children}</p>
      </div>
    </li>
  );
}

export function Onboarding() {
  useDocumentTitle("Set up your search · Nestor");
  const { isLoading, isAuthenticated } = useConvexAuth();
  const renter = useQuery(api.renters.me, isAuthenticated ? {} : "skip");
  const viewer = useQuery(api.users.viewer, isAuthenticated ? {} : "skip");
  const save = useMutation(api.renters.save);
  const navigate = useNavigate();

  const [draft, setDraft] = useState<ProfileDraft>(emptyDraft);
  const [step, setStep] = useState<DraftStep>(1);
  const [attempted, setAttempted] = useState<ReadonlySet<DraftStep>>(new Set());
  const [saving, setSaving] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [previewSince] = useState(() => Date.now());

  const allErrors = useMemo(() => validateDraft(draft), [draft]);
  const visibleErrors = attempted.has(step) ? errorsForStep(allErrors, step) : {};
  const preview = useMemo(() => passportFromDraft(draft, previewSince), [draft, previewSince]);

  // Moving between steps: start at the top and put the screen reader on the new question.
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    window.scrollTo({ top: 0 });
    headingRef.current?.focus({ preventScroll: true });
  }, [step]);

  if (isLoading) return <PageLoader label="Opening Nestor" />;
  if (!isAuthenticated) return <Navigate to="/signin" replace />;
  if (renter === undefined) return <PageLoader label="Opening Nestor" />;
  if (renter !== null) return <Navigate to="/app" replace />;

  const current = STEPS[step - 1];
  const change = (patch: Partial<ProfileDraft>) => setDraft((prev) => ({ ...prev, ...patch }));

  function focusFirstProblem() {
    window.requestAnimationFrame(() => {
      const field = formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]');
      field?.focus();
      field?.scrollIntoView({ block: "center" });
    });
  }

  async function finish() {
    const problemStep = firstStepWithErrors(allErrors);
    if (problemStep !== null) {
      setAttempted(new Set<DraftStep>([1, 2, 3]));
      setStep(problemStep);
      focusFirstProblem();
      return;
    }
    setSaving(true);
    try {
      await save(toSaveArgs(draft));
      toast.success(`Welcome, ${draft.displayName.trim().split(/\s+/)[0]}. Your dashboard is ready.`);
      navigate("/app", { replace: true });
    } catch (error) {
      setSaving(false);
      toast.error(errorSentence(error, "Nestor could not save your profile. Please try again."));
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    if (Object.keys(errorsForStep(allErrors, step)).length > 0) {
      setAttempted((prev) => new Set(prev).add(step));
      focusFirstProblem();
      return;
    }
    if (step < 3) setStep((step + 1) as DraftStep);
    else void finish();
  }

  const fieldProps = { draft, errors: visibleErrors, onChange: change };

  return (
    <div className="paper-grain min-h-dvh">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-5 py-6 sm:px-8">
        <Logo />
        <div className="flex items-center gap-2 sm:gap-4">
          <p className="text-sm text-ink-soft">
            Step <span className="font-semibold text-ink">{step}</span> of 3
          </p>
          <SignOutButton labelled />
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-5 pb-20 sm:px-8">
        <nav aria-label="Setup steps">
          <ol className="grid grid-cols-3 gap-2 sm:gap-4">
            {STEPS.map((item) => {
              const done = item.step < step;
              const active = item.step === step;
              return (
                <li key={item.step}>
                  <button
                    type="button"
                    onClick={() => setStep(item.step)}
                    disabled={!done}
                    aria-current={active ? "step" : undefined}
                    className={cn(
                      "group flex w-full items-center gap-2.5 border-t-2 pt-3 text-left transition-colors",
                      active ? "border-forest" : done ? "cursor-pointer border-moss" : "border-line-strong",
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                        active
                          ? "bg-forest text-paper"
                          : done
                            ? "bg-forest-soft text-forest-deep"
                            : "bg-paper-deep text-ink-faint",
                      )}
                    >
                      {done ? <Check className="size-3.5" aria-hidden="true" /> : item.step}
                    </span>
                    <span
                      className={cn(
                        "hidden text-sm font-medium sm:block",
                        active ? "text-ink" : done ? "text-ink-soft group-hover:text-forest" : "text-ink-faint",
                      )}
                    >
                      {item.label}
                    </span>
                    <span className="sr-only sm:hidden">{item.label}</span>
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>

        <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-12">
          <form ref={formRef} onSubmit={onSubmit} noValidate>
            <Eyebrow>{current.label}</Eyebrow>
            <h1
              ref={headingRef}
              tabIndex={-1}
              className="mt-2 text-3xl leading-tight text-ink focus:outline-none sm:text-4xl"
            >
              {current.title}
            </h1>
            <p className="mt-2 max-w-xl text-ink-soft">{current.lede}</p>

            {viewer?.isAnonymous && step === 1 && (
              <Callout tone="honey" title="You're looking around as a guest" className="mt-6">
                Conversations will use Nestor's demo landlord, so you can try everything without
                emailing anyone. Create a free account later in Settings and your search comes with you.
              </Callout>
            )}

            <div
              key={step}
              className="animate-rise mt-6 space-y-6 rounded-card border border-line bg-card p-5 shadow-card sm:p-7"
            >
              {step === 1 && (
                <>
                  <NameField {...fieldProps} />
                  <SearchFields {...fieldProps} />
                  <TimingFields {...fieldProps} />
                </>
              )}
              {step === 2 && (
                <>
                  <AboutFields {...fieldProps} />
                  <hr className="border-line" />
                  <HouseholdFields {...fieldProps} />
                  <hr className="border-line" />
                  <FinancialFields {...fieldProps} />
                </>
              )}
              {step === 3 && (
                <>
                  <GoalFields {...fieldProps} />
                  {draft.negotiationGoals.length === 0 && (
                    <Callout tone="neutral">
                      With nothing selected, Nestor will ask about availability and tours and leave
                      the terms alone. You can change this any time.
                    </Callout>
                  )}
                  <p className="flex items-start gap-2 text-xs leading-relaxed text-ink-soft">
                    <Lock className="mt-px size-3.5 shrink-0 text-moss" aria-hidden="true" />
                    Your goals are private. Landlords only ever see the emails you approve.
                  </p>
                </>
              )}
            </div>

            <div className="mt-6 flex items-center justify-between gap-3">
              {step > 1 ? (
                <Button
                  variant="ghost"
                  onClick={() => setStep((step - 1) as DraftStep)}
                  disabled={saving}
                  icon={<ArrowLeft className="size-4" aria-hidden="true" />}
                >
                  Back
                </Button>
              ) : (
                <span />
              )}
              <Button type="submit" size="lg" variant={step === 3 ? "accent" : "primary"} loading={saving}>
                {step === 3 ? "Open my dashboard" : "Continue"}
                {!saving && <ArrowRight className="size-4" aria-hidden="true" />}
              </Button>
            </div>
          </form>

          <aside className="lg:pt-16" aria-label={step === 2 ? "Passport preview" : "Good to know"}>
            {step === 1 && (
              <ul className="space-y-5 rounded-card border border-line bg-paper-deep/50 p-5 sm:p-6">
                <AsidePoint icon={<ScanSearch className="size-4" aria-hidden="true" />} title="Every listing gets a score">
                  Budget, bedrooms, pets, move-in date and must-haves all count, and Nestor tells you
                  why a listing scored the way it did.
                </AsidePoint>
                <AsidePoint icon={<Lock className="size-4" aria-hidden="true" />} title="Your budget stays with you">
                  It never appears in an email, on your Passport, or in anything a landlord can read.
                </AsidePoint>
                <AsidePoint icon={<Check className="size-4" aria-hidden="true" />} title="Nothing here is final">
                  Change any answer later from your Passport page. Match scores update by themselves.
                </AsidePoint>
              </ul>
            )}
            {step === 2 && (
              <div className="animate-rise lg:sticky lg:top-8">
                <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-moss">
                  What a landlord will see
                </p>
                <PassportCard passport={preview} compact nameAs="p" />
                <p className="mt-3 text-xs leading-relaxed text-ink-faint">
                  Ranges, never documents. No budget, no email address, no negotiation goals.
                </p>
              </div>
            )}
            {step === 3 && (
              <ul className="space-y-5 rounded-card border border-line bg-paper-deep/50 p-5 sm:p-6">
                <AsidePoint icon={<MailCheck className="size-4" aria-hidden="true" />} title="You approve every email">
                  Each draft waits for your OK, with the Negotiator's reasoning next to it. Autopilot
                  is off until you switch it on in Settings.
                </AsidePoint>
                <AsidePoint icon={<ShieldCheck className="size-4" aria-hidden="true" />} title="It never bluffs">
                  No invented offers or deadlines. It says it is an AI assistant writing for you, and
                  it never agrees to sign or pay anything.
                </AsidePoint>
              </ul>
            )}
          </aside>
        </div>
      </main>
    </div>
  );
}
