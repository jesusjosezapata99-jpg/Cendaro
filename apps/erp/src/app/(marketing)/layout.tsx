import { Footer } from "../_components/landing/footer";
import { Navbar } from "../_components/landing/nav/navbar";
import { RevealObserver } from "../_components/landing/primitives/reveal-observer";

/**
 * Runs before the sections below are parsed, so `<Reveal>` content starts
 * hidden only when JavaScript is available and the visitor is not a search or
 * AI crawler (Googlebot WRS, Bingbot, Perplexity, Claude, OAI-SearchBot,
 * Lighthouse do not scroll pages, so they must see every section at opacity 1
 * on Frame 0). Allowed by the static CSP's script-src 'unsafe-inline'
 * (apps/erp/csp.mjs, finding M3).
 */
const REVEAL_BOOTSTRAP =
  "if(!/bot|crawl|spider|google|bing|perplexity|claude|gpt|lighthouse/i.test(navigator.userAgent))document.documentElement.classList.add('js-reveal')";

/**
 * Shared shell of the public marketing site: `/` and `/funciones/*`
 * (PLAN-2026-09-LANDING-REDESIGN §4.2). The route group does not change URLs.
 */
export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: REVEAL_BOOTSTRAP }} />
      <RevealObserver />
      <a
        href="#contenido"
        className="bg-foreground text-background focus-visible:ring-ring sr-only z-60 px-4 py-2 text-sm focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus-visible:ring-2"
      >
        Saltar al contenido
      </a>
      <Navbar />
      <main id="contenido" tabIndex={-1} className="outline-none">
        {children}
      </main>
      <Footer />
    </>
  );
}
