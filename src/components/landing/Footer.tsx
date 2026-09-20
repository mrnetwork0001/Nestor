import { ArrowUpRight } from "lucide-react";
import { Link } from "react-router";
import { Logo } from "@/components/Logo";

const REPO = "https://github.com/mrnetwork0001/Nestor";

const linkClass =
  "text-sm text-ink-soft underline-offset-4 transition-colors hover:text-forest hover:underline";

export function Footer({ destination }: { destination: string }) {
  return (
    <footer className="bg-paper">
      <div className="mx-auto w-full max-w-[calc(50vw+38rem)] px-5 py-14 sm:px-8">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-[minmax(0,5fr)_minmax(0,3fr)_minmax(0,3fr)]">
          <div>
            <Logo />
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-ink-soft">
              An apartment-hunting concierge that scouts listings, writes to landlords, lines up
              tours and checks the lease. You make every decision.
            </p>
          </div>

          <nav aria-label="Footer: on this page">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-faint">
              On this page
            </p>
            <ul className="mt-4 space-y-2.5">
              <li>
                <a href="#how" className={linkClass}>
                  How it works
                </a>
              </li>
              <li>
                <a href="#features" className={linkClass}>
                  Features
                </a>
              </li>
              <li>
                <a href="#lease" className={linkClass}>
                  Lease check
                </a>
              </li>
            </ul>
          </nav>

          <nav aria-label="Footer: Nestor">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-faint">Nestor</p>
            <ul className="mt-4 space-y-2.5">
              <li>
                <Link to={destination} className={linkClass}>
                  Launch app
                </Link>
              </li>
              <li>
                <Link to="/signin" className={linkClass}>
                  Sign in
                </Link>
              </li>
              <li>
                <a href={REPO} target="_blank" rel="noreferrer" className={`${linkClass} inline-flex items-center gap-1`}>
                  Open source on GitHub
                  <ArrowUpRight className="size-3.5" aria-hidden="true" />
                  <span className="sr-only">(opens in a new tab)</span>
                </a>
              </li>
            </ul>
          </nav>
        </div>
      </div>
    </footer>
  );
}
