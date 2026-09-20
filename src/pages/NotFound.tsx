import { ArrowRight } from "@/components/icons";
import { Logo } from "@/components/Logo";
import { LinkButton } from "@/components/landing/LinkButton";
import { RooflineRule } from "@/components/landing/Motif";
import { useDocumentTitle } from "@/components/landing/useDocumentTitle";

export function NotFound() {
  useDocumentTitle("Page not found · Nestor");
  return (
    <div className="paper-grain flex min-h-dvh flex-col">
      <header className="mx-auto w-full max-w-6xl px-5 py-6 sm:px-8">
        <Logo />
      </header>
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-5 pb-24 sm:px-8">
        <p className="font-display text-7xl leading-none text-clay sm:text-8xl">404</p>
        <RooflineRule className="mt-6" />
        <h1 className="mt-6 text-4xl leading-tight text-ink">Nobody lives at this address.</h1>
        <p className="mt-3 text-lg leading-relaxed text-ink-soft">
          The page you followed may have moved, or the link may be mistyped. Your listings and
          conversations are safe where you left them.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <LinkButton to="/app" size="lg" icon={<ArrowRight className="size-4" aria-hidden="true" />}>
            Open your dashboard
          </LinkButton>
          <LinkButton to="/" size="lg" variant="secondary">
            Go to the front page
          </LinkButton>
        </div>
      </main>
    </div>
  );
}
