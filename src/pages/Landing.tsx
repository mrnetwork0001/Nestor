import { useEffect } from "react";
// The hero and closing headlines set one phrase in Fraunces italic. Only this
// page uses the italic, so the face is loaded here rather than app-wide.
import "@fontsource-variable/fraunces/wght-italic.css";
import { BuiltWith } from "@/components/landing/BuiltWith";
import { ClosingCta } from "@/components/landing/ClosingCta";
import { Features } from "@/components/landing/Features";
import { Footer } from "@/components/landing/Footer";
import { Hero } from "@/components/landing/Hero";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { LandingNav } from "@/components/landing/LandingNav";
import { LeaseCheck } from "@/components/landing/LeaseCheck";
import { NegotiationLedger } from "@/components/landing/NegotiationLedger";
import { Trust } from "@/components/landing/Trust";
import { useDocumentTitle } from "@/components/landing/useDocumentTitle";
import { useLaunch } from "@/components/landing/useLaunch";

export function Landing() {
  useDocumentTitle("Nestor · Get the keys, skip the back-and-forth");
  const launch = useLaunch();

  // Anchor links glide instead of jumping, unless the visitor asked for less motion.
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const root = document.documentElement;
    const previous = root.style.scrollBehavior;
    root.style.scrollBehavior = "smooth";
    return () => {
      root.style.scrollBehavior = previous;
    };
  }, []);

  const cta = {
    destination: launch.destination,
    isAuthenticated: launch.isAuthenticated,
    startGuest: launch.startGuest,
    guestPending: launch.guestPending,
  };

  return (
    <div className="bg-paper text-ink">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-xl focus:bg-forest focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-paper"
      >
        Skip to content
      </a>
      <LandingNav />
      <main id="main">
        <Hero {...cta} />
        <HowItWorks />
        <NegotiationLedger />
        <Features />
        <LeaseCheck destination={launch.destination} />
        <Trust />
        <BuiltWith />
        <ClosingCta {...cta} />
      </main>
      <Footer destination={launch.destination} />
    </div>
  );
}
