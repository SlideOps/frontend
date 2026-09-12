import { ThemeProvider } from '@slideops/design-system';
import { GuidanceProvider } from '@slideops/tooltips';
import { StrictMode } from 'react';
import { renderToString } from 'react-dom/server';
import { Routes } from 'react-router-dom';
import { StaticRouter } from 'react-router-dom/server';
import { guidance } from './guidance';
import { marketingRoutes } from './marketing/routes';

/*
 * The build's server entry: renders a public page to HTML.
 *
 * scripts/prerender.mjs builds this with Vite's SSR mode and calls it once per
 * public page, so a crawler gets the page's real text in the HTML rather than an
 * empty root waiting for JavaScript. The providers mirror main.tsx; the routes
 * are the same marketingRoutes the application mounts.
 */

/** The HTML of the public page at this URL, without the document around it. */
export function render(url: string): string {
  return renderToString(
    <StrictMode>
      <ThemeProvider>
        <GuidanceProvider registry={guidance}>
          <StaticRouter location={url}>
            <Routes>{marketingRoutes()}</Routes>
          </StaticRouter>
        </GuidanceProvider>
      </ThemeProvider>
    </StrictMode>,
  );
}

export {
  appShellHead,
  headFor,
  notFoundHead,
  publicHead,
  publicPages,
  renderHeadHtml,
} from './seo/head';
export { llmsFullTxt, llmsTxt, robotsTxt, sitemapXml } from './seo/files';
export { SITE_URL } from './seo/site';
