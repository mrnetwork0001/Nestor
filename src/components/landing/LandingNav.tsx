import { useEffect, useState } from "react";
import { Menu, X } from "@/components/icons";
import { Logo } from "@/components/Logo";
import { cn } from "@/lib/cn";

const SECTIONS = [
  { href: "#how", label: "How it works" },
  { href: "#features", label: "Features" },
  { href: "#lease", label: "Lease check" },
];

/*
 * Logo on the left, section links on the right, nothing else. The bar is
 * deliberately wider than the page: its side margins are half the content's. Launch app,
 * sign in and sign out deliberately live elsewhere: the hero and closing band
 * launch the app, /signin handles accounts, and the app sidebar signs out.
 */
export function LandingNav() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 border-b bg-paper transition-[border-color,box-shadow] duration-200",
        scrolled || open ? "border-line shadow-card" : "border-transparent",
      )}
    >
      <div className="mx-auto flex h-16 w-full max-w-[calc(75vw+19rem)] items-center justify-between gap-3 px-5 sm:px-4">
        <Logo variant="lockup" size="h-12" />

        <nav aria-label="On this page" className="hidden items-center gap-8 md:flex">
          {SECTIONS.map((section) => (
            <a
              key={section.href}
              href={section.href}
              className="text-sm text-ink-soft underline-offset-8 transition-colors hover:text-forest hover:underline"
            >
              {section.label}
            </a>
          ))}
        </nav>

        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-controls="landing-menu"
          aria-label={open ? "Close menu" : "Open menu"}
          className="flex size-10 cursor-pointer items-center justify-center rounded-xl text-ink-soft transition-colors hover:bg-paper-deep hover:text-ink md:hidden"
        >
          {open ? <X className="size-5" aria-hidden="true" /> : <Menu className="size-5" aria-hidden="true" />}
        </button>
      </div>

      {open && (
        <nav
          id="landing-menu"
          aria-label="On this page"
          className="animate-rise border-t border-line px-5 pb-4 pt-2 sm:px-4 md:hidden"
        >
          <ul className="divide-y divide-line">
            {SECTIONS.map((section) => (
              <li key={section.href}>
                <a
                  href={section.href}
                  onClick={() => setOpen(false)}
                  className="block py-3 font-display text-xl text-ink"
                >
                  {section.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </header>
  );
}
