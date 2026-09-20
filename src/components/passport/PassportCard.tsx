import type { ReactNode } from "react";
import {
  BedDouble,
  Briefcase,
  CalendarDays,
  CigaretteOff,
  Cigarette,
  Gauge,
  KeyRound,
  PawPrint,
  ScrollText,
  Users,
  Wallet,
} from "@/components/icons";
import { cn } from "@/lib/cn";
import { CREDIT_LABEL, INCOME_LABEL, dayLabel } from "@/lib/format";
import { firstNameOf, type PassportFacts } from "./passportFacts";

/*
 * The Renter Passport as a landlord sees it. The public page, the editor's
 * live preview and the landing page all render this one component, so what the
 * renter previews is exactly what gets shared.
 */

function initialsOf(displayName: string): string {
  const words = displayName.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  const first = words[0][0] ?? "";
  const last = words.length > 1 ? (words[words.length - 1][0] ?? "") : "";
  return (first + last).toUpperCase();
}

function monthYear(ms: number): string {
  return new Date(ms).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function bedroomsLabel(min: number): string {
  if (min <= 0) return "Studio or larger";
  return `${min}+ bedroom${min === 1 ? "" : "s"}`;
}

function Fact({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-forest-soft text-forest print:border print:border-line">
        {icon}
      </span>
      <div className="min-w-0">
        <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-faint">
          {label}
        </dt>
        <dd className="mt-0.5 text-sm font-medium leading-snug text-ink [overflow-wrap:anywhere]">
          {value}
        </dd>
      </div>
    </div>
  );
}

export function PassportCard({
  passport,
  compact = false,
  wide = false,
  nameAs: NameTag = "h2",
  className,
}: {
  passport: PassportFacts;
  /** Drops the bio and the footnote. Used where the card is an illustration. */
  compact?: boolean;
  /** Three fact columns on large screens. Only for a card that spans the page. */
  wide?: boolean;
  /** The public page makes the name its h1; previews sit under a page heading. */
  nameAs?: "h1" | "h2" | "h3" | "p";
  className?: string;
}) {
  const first = firstNameOf(passport.displayName);
  const name = passport.displayName.trim() || "Your name";
  const petsValue = passport.pets.hasPets
    ? passport.pets.description?.trim() || "Has pets"
    : "No pets";
  const identity = [passport.occupation, `Looking in ${passport.city.trim() || "their city"}`]
    .filter(Boolean)
    .join(" · ");

  return (
    <article
      className={cn(
        "@container overflow-hidden rounded-card border border-line bg-card shadow-card print:shadow-none",
        className,
      )}
    >
      <header className="flex items-center justify-between gap-3 border-b border-line bg-paper-deep/50 px-5 py-3 sm:px-7">
        <span className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-forest">
          <KeyRound className="size-3.5" aria-hidden="true" />
          Renter Passport
        </span>
        <span className="text-xs text-ink-faint">Shared through Nestor</span>
      </header>

      <div className={cn("px-5 sm:px-7", compact ? "py-5" : "py-6 sm:py-7")}>
        <div className="flex items-center gap-4">
          <span
            aria-hidden="true"
            className={cn(
              "flex shrink-0 items-center justify-center rounded-full bg-forest font-display text-paper",
              compact ? "size-12 text-lg" : "size-14 text-xl sm:size-16 sm:text-2xl",
            )}
          >
            {initialsOf(name)}
          </span>
          <div className="min-w-0">
            <NameTag
              className={cn(
                "font-display leading-tight tracking-tight text-ink [overflow-wrap:anywhere]",
                compact ? "text-xl" : "text-2xl sm:text-3xl",
              )}
            >
              {name}
            </NameTag>
            <p className="mt-1 text-sm text-ink-soft [overflow-wrap:anywhere]">{identity}</p>
          </div>
        </div>

        {passport.headline && (
          <p
            className={cn(
              "mt-4 font-display leading-snug text-ink [overflow-wrap:anywhere]",
              compact ? "text-base" : "text-lg sm:text-xl",
            )}
          >
            {passport.headline}
          </p>
        )}

        <dl
          className={cn(
            "mt-5 grid grid-cols-1 gap-x-6 gap-y-4 border-t border-line pt-5",
            // Container widths, so the card lays itself out the same in a sidebar as on a page.
            compact ? "grid-cols-2 @[32rem]:grid-cols-3" : "grid-cols-1 @[22rem]:grid-cols-2",
            wide && "@[44rem]:grid-cols-3",
          )}
        >
          <Fact
            icon={<CalendarDays className="size-4" aria-hidden="true" />}
            label="Move-in"
            value={dayLabel(passport.moveInDate)}
          />
          <Fact
            icon={<ScrollText className="size-4" aria-hidden="true" />}
            label="Lease length"
            value={passport.leaseTermMonths ? `${passport.leaseTermMonths} months` : "Flexible"}
          />
          <Fact
            icon={<BedDouble className="size-4" aria-hidden="true" />}
            label="Looking for"
            value={bedroomsLabel(passport.bedroomsMin)}
          />
          <Fact
            icon={<Users className="size-4" aria-hidden="true" />}
            label="Household"
            value={passport.occupants === 1 ? "1 person" : `${passport.occupants} people`}
          />
          <Fact icon={<PawPrint className="size-4" aria-hidden="true" />} label="Pets" value={petsValue} />
          <Fact
            icon={
              passport.smoker ? (
                <Cigarette className="size-4" aria-hidden="true" />
              ) : (
                <CigaretteOff className="size-4" aria-hidden="true" />
              )
            }
            label="Smoking"
            value={passport.smoker ? "Smoker" : "Non-smoker"}
          />
          <Fact
            icon={<Gauge className="size-4" aria-hidden="true" />}
            label="Credit range"
            value={CREDIT_LABEL[passport.creditBand] ?? passport.creditBand}
          />
          <Fact
            icon={<Wallet className="size-4" aria-hidden="true" />}
            label="Income range"
            value={INCOME_LABEL[passport.incomeBand] ?? passport.incomeBand}
          />
          <Fact
            icon={<Briefcase className="size-4" aria-hidden="true" />}
            label="Rental history"
            value={passport.hasRentalHistory ? "Has rented before" : "First-time renter"}
          />
        </dl>

        {!compact && passport.bio && (
          <section className="mt-6 border-t border-line pt-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-faint">
              In {first}'s words
            </p>
            <p className="mt-2 whitespace-pre-line text-[15px] leading-relaxed text-ink-soft [overflow-wrap:anywhere]">
              {passport.bio}
            </p>
          </section>
        )}
      </div>

      {!compact && (
        <footer className="border-t border-line bg-paper-deep/50 px-5 py-4 text-xs leading-relaxed text-ink-soft sm:px-7">
          <p>
            <span className="font-semibold text-ink">Self-reported.</span> {first} provided these
            facts through Nestor, and nobody has independently verified them. Nestor shares ranges
            only, never documents, account numbers or contact details. Please confirm income and
            credit through your usual application.
          </p>
          <p className="mt-1.5 text-ink-faint">On Nestor since {monthYear(passport.memberSince)}</p>
        </footer>
      )}
    </article>
  );
}
