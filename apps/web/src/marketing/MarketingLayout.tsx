import { Outlet } from 'react-router-dom';
import { Glow, Grain } from './motion';
import { SiteFooter } from './sections/SiteFooter';
import { SiteHeader } from './sections/SiteHeader';

/**
 * The public marketing frame: a marketing header and footer around whichever
 * marketing route is active. Both themes, responsive, and a skip link so the
 * keyboard reaches the content first. The signed-in areas use their own shells.
 *
 * Behind the content sits a single ambient warmth layer, a couple of slow warm
 * glows and a fine grain, the foundation of the living marketing aesthetic. It
 * is fixed, decorative, non-interactive, and fully static under reduced motion.
 */
export function MarketingLayout() {
  return (
    <div className="relative min-h-screen bg-app text-ink">
      {/* Ambient warmth: warm-glow-on-warm-dark, from tokens, behind everything. */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <Glow color="ember" size="52rem" x="82%" y="6%" pulse />
        <Glow color="warm" size="46rem" x="8%" y="30%" pulse />
        <Grain />
      </div>
      <a
        href="#top"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-brand focus:px-4 focus:py-2 focus:text-sm focus:text-brand-fg"
      >
        Skip to content
      </a>
      <SiteHeader />
      <main>
        <Outlet />
      </main>
      <SiteFooter />
    </div>
  );
}
