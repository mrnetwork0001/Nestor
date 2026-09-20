import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useMutation, useQuery } from "convex/react";
import { Check, Copy, ExternalLink, Eye, Lock, RefreshCw } from "@/components/icons";
import { toast } from "sonner";
import { api } from "../../convex/_generated/api";
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
  draftFromRenter,
  passportFromDraft,
  sameDraft,
  toSaveArgs,
  validateDraft,
  type ProfileDraft,
} from "@/components/onboarding/profileDraft";
import { PassportCard } from "@/components/passport/PassportCard";
import { Badge, Button, Card, PageHeader, Skeleton } from "@/components/ui";
import { errorSentence } from "@/lib/errors";

function Section({
  title,
  lede,
  badge,
  children,
}: {
  title: string;
  lede: string;
  badge: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card className="p-5 sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <h2 className="text-xl text-ink">{title}</h2>
          <p className="mt-1 text-sm text-ink-soft">{lede}</p>
        </div>
        {badge}
      </div>
      <div className="mt-6 space-y-6">{children}</div>
    </Card>
  );
}

const onPassport = (
  <Badge tone="forest">
    <Eye className="size-3" aria-hidden="true" />
    On your Passport
  </Badge>
);
const privateBadge = (
  <Badge>
    <Lock className="size-3" aria-hidden="true" />
    Private
  </Badge>
);

function ShareCard({ token, views }: { token: string; views: number }) {
  const rotate = useMutation(api.renters.rotatePassportToken);
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [rotating, setRotating] = useState(false);
  const copyTimer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(copyTimer.current), []);

  const path = `/passport/${token}`;
  const url = `${window.location.origin}${path}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.clearTimeout(copyTimer.current);
      copyTimer.current = window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Your browser blocked copying. Select the link and copy it by hand.");
    }
  }

  async function replaceLink() {
    setRotating(true);
    try {
      await rotate({});
      toast.success("New Passport link ready. The old one no longer works.");
      setConfirming(false);
    } catch (error) {
      toast.error(errorSentence(error, "Nestor could not replace the link. Please try again."));
    } finally {
      setRotating(false);
    }
  }

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg text-ink">Your Passport link</h2>
        <Badge tone={views > 0 ? "forest" : "neutral"}>
          <Eye className="size-3" aria-hidden="true" />
          <span key={views} className="animate-rise tabular-nums">
            {views === 0 ? "Not opened yet" : `Opened ${views} ${views === 1 ? "time" : "times"}`}
          </span>
        </Badge>
      </div>
      <p className="mt-1 text-sm text-ink-soft">
        Nestor adds this link to the first email it sends each landlord. Views are counted, never
        who viewed.
      </p>

      <label htmlFor="passport-link" className="sr-only">
        Passport link
      </label>
      <input
        id="passport-link"
        readOnly
        value={url}
        onFocus={(event) => event.currentTarget.select()}
        className="mt-4 h-10 w-full rounded-xl border border-line-strong bg-paper px-3.5 text-sm text-ink-soft focus:border-forest focus:outline-none focus:ring-2 focus:ring-forest/15"
      />

      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          onClick={copy}
          icon={copied ? <Check className="size-4" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
        >
          {copied ? "Copied" : "Copy link"}
        </Button>
        <a
          href={path}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-line-strong bg-card px-4 text-sm font-medium text-ink transition-colors hover:border-forest hover:text-forest"
        >
          <ExternalLink className="size-4" aria-hidden="true" />
          Open as a landlord
        </a>
      </div>
      <span role="status" className="sr-only">
        {copied ? "Link copied" : ""}
      </span>

      <div className="mt-5 border-t border-line pt-4">
        {confirming ? (
          <div className="animate-rise space-y-3">
            <p className="text-sm leading-relaxed text-ink-soft">
              The current link stops working immediately, including in emails Nestor already sent.
              Landlords who open it will be told to ask you for the new one.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="danger" onClick={replaceLink} loading={rotating}>
                Replace the link
              </Button>
              <Button variant="ghost" onClick={() => setConfirming(false)} disabled={rotating}>
                Keep it
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs leading-relaxed text-ink-faint">Shared it somewhere you regret?</p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setConfirming(true)}
              icon={<RefreshCw className="size-3.5" aria-hidden="true" />}
            >
              Replace link
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}

function EditorSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_24rem]" role="status" aria-label="Loading your Passport">
      <div className="space-y-6">
        <Skeleton className="h-72 rounded-card" />
        <Skeleton className="h-96 rounded-card" />
      </div>
      <div className="space-y-6">
        <Skeleton className="h-56 rounded-card" />
        <Skeleton className="h-80 rounded-card" />
      </div>
    </div>
  );
}

export function PassportEditor() {
  useDocumentTitle("Your Passport · Nestor");
  const renter = useQuery(api.renters.me);
  const save = useMutation(api.renters.save);

  const [form, setForm] = useState<{ baseline: ProfileDraft; draft: ProfileDraft } | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const [saving, setSaving] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  // The stored profile is the baseline. When it changes underneath an
  // untouched form (first load, a save landing, another tab), follow it; a
  // form with unsaved edits is left alone so typing is never overwritten.
  useEffect(() => {
    if (!renter) return;
    const stored = draftFromRenter(renter);
    setForm((prev) =>
      prev === null || sameDraft(prev.draft, prev.baseline)
        ? { baseline: stored, draft: stored }
        : { ...prev, baseline: stored },
    );
  }, [renter]);

  const draft = form?.draft ?? null;
  const baseline = form?.baseline ?? null;

  const errors = useMemo(() => (draft ? validateDraft(draft) : {}), [draft]);
  const preview = useMemo(
    () => (draft && renter ? passportFromDraft(draft, renter._creationTime) : null),
    [draft, renter],
  );
  const dirty = draft !== null && baseline !== null && !sameDraft(draft, baseline);
  const hasErrors = Object.keys(errors).length > 0;

  // Closing the tab with unsaved Passport edits deserves a warning.
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft || saving) return;
    if (hasErrors) {
      setShowErrors(true);
      window.requestAnimationFrame(() => {
        const field = formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]');
        field?.focus();
        field?.scrollIntoView({ block: "center" });
      });
      toast.error("A few answers need another look before Nestor can save.");
      return;
    }
    setSaving(true);
    try {
      await save(toSaveArgs(draft));
      // Treat what was just saved as the baseline so the reactive update that follows is a no-op.
      setForm((prev) => (prev ? { ...prev, baseline: draft } : prev));
      setShowErrors(false);
      toast.success("Passport saved. Match scores will refresh in a moment.");
    } catch (error) {
      toast.error(errorSentence(error, "Nestor could not save your Passport. Please try again."));
    } finally {
      setSaving(false);
    }
  }

  const fieldProps = draft
    ? {
        draft,
        errors: showErrors ? errors : {},
        onChange: (patch: Partial<ProfileDraft>) =>
          setForm((prev) => (prev ? { ...prev, draft: { ...prev.draft, ...patch } } : prev)),
      }
    : null;

  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-8 lg:py-10">
      <PageHeader
        eyebrow="Renter Passport"
        title="Your introduction to landlords"
        lede="One honest page that answers a landlord's first questions. Nestor links it in the first email of every conversation. It shows ranges, never documents, and never your budget."
      />

      <div className="mt-8">
        {renter === undefined || !fieldProps || !preview ? (
          renter === null ? null : <EditorSkeleton />
        ) : (
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-start">
            <div className="space-y-6 lg:sticky lg:top-4 lg:order-2 lg:-m-2 lg:max-h-[calc(100dvh-2rem)] lg:overflow-y-auto lg:p-2">
              {renter && <ShareCard token={renter.passportToken} views={renter.passportViews} />}
              <div>
                <p className="mb-3 flex items-center justify-between gap-3 text-xs font-semibold uppercase tracking-[0.14em] text-moss">
                  Live preview
                  {dirty && <span className="animate-rise normal-case tracking-normal text-honey">Unsaved changes</span>}
                </p>
                <PassportCard passport={preview} nameAs="p" />
              </div>
            </div>

            <form ref={formRef} onSubmit={onSubmit} noValidate className="space-y-6 lg:order-1">
              <Section
                title="About you"
                lede="Your name and a few words in your own voice."
                badge={onPassport}
              >
                <NameField {...fieldProps} />
                <AboutFields {...fieldProps} />
              </Section>

              <Section
                title="Household and move"
                lede="The facts landlords ask about first."
                badge={onPassport}
              >
                <HouseholdFields {...fieldProps} />
                <TimingFields {...fieldProps} />
                <FinancialFields {...fieldProps} />
              </Section>

              <Section
                title="Your search"
                lede="Used by the Scout to score listings. Only your city and bedroom count appear on the Passport."
                badge={privateBadge}
              >
                <SearchFields {...fieldProps} />
              </Section>

              <Section
                title="What Nestor negotiates"
                lede="The Negotiator asks for at most two of these per email, when the listing gives it a reason."
                badge={privateBadge}
              >
                <GoalFields {...fieldProps} />
              </Section>

              <div className="sticky bottom-20 z-10 flex flex-wrap items-center justify-between gap-3 rounded-card border border-line bg-card px-5 py-3 shadow-lift lg:bottom-4">
                <p className="text-sm text-ink-soft" role="status">
                  {dirty ? "You have unsaved changes." : "Everything is saved."}
                </p>
                <div className="flex gap-2">
                  {dirty && (
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setForm((prev) => (prev ? { ...prev, draft: prev.baseline } : prev));
                        setShowErrors(false);
                      }}
                      disabled={saving}
                    >
                      Undo changes
                    </Button>
                  )}
                  <Button type="submit" loading={saving} disabled={!dirty}>
                    Save Passport
                  </Button>
                </div>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
