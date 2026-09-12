import { Route } from 'react-router-dom';
import { docsRoutes } from './docs-site';
import { MarketingLayout } from './MarketingLayout';
import { NotFoundPage } from './NotFoundPage';
import { AudiencePage, CapabilitiesPage, MarketingHome, PricingPage, StoryPage } from './pages';

/*
 * The public site's routes, defined once.
 *
 * The application mounts these, and the build renders these to static HTML for
 * every public page. Writing them out twice would let the page a crawler reads
 * drift from the page a visitor gets.
 */

/** Every public route, inside the marketing frame, ready to place inside Routes. */
export function marketingRoutes() {
  return (
    <Route element={<MarketingLayout />}>
      <Route path="/" element={<MarketingHome />} />
      <Route path="/story" element={<StoryPage />} />
      <Route path="/capabilities" element={<CapabilitiesPage />} />
      <Route path="/audience" element={<AudiencePage />} />
      {/* The documentation site. /docs is its index and every page lives
          at /docs/<section>/<page>, in manifest order. */}
      {docsRoutes()}
      <Route path="/pricing" element={<PricingPage />} />
      {/* An address nothing else claims says so, with a real 404 in the
          published build, rather than showing the home page under it. */}
      <Route path="*" element={<NotFoundPage />} />
    </Route>
  );
}
