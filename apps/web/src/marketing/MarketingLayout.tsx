import { Outlet } from 'react-router-dom';
import { SiteFooter } from './sections/SiteFooter';
import { SiteHeader } from './sections/SiteHeader';

/**
 * The public marketing frame: a marketing header and footer around whichever
 * marketing route is active. Both themes, responsive, and a skip link so the
 * keyboard reaches the content first. The signed-in areas use their own shells.
 */
export function MarketingLayout() {
  return (
    <div className="min-h-screen bg-app text-ink">
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
