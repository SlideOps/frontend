/*
 * Where the public site lives, and what it is called.
 *
 * Every absolute URL the site publishes about itself (canonical links, Open
 * Graph, structured data, the sitemap, robots.txt, llms.txt) is built from
 * SITE_URL, so moving the canonical host is one edit here. It names the host the
 * apex domain redirects to: a canonical that disagreed with the redirect would
 * send search engines two answers to the same question.
 */

/** The canonical origin of the public site, with no trailing slash. */
export const SITE_URL = 'https://www.useslideops.com';

/** The product's name, as search results and link previews show it. */
export const SITE_NAME = 'SlideOps';

/** Used wherever a page has no description of its own. */
export const DEFAULT_DESCRIPTION =
  'SlideOps helps Operators discover, configure, deploy, secure, verify and monitor the servers they own, over SSH. Every meaningful change is planned, approved, verified and recorded.';

/** The image a link preview shows, 1200 by 630, served from the site root. */
export const OG_IMAGE_PATH = '/og-image.png';
export const OG_IMAGE_WIDTH = 1200;
export const OG_IMAGE_HEIGHT = 630;
export const OG_IMAGE_ALT = 'SlideOps: operate your own infrastructure with confidence.';

/** An absolute URL on the canonical host for a site path. */
export function absoluteUrl(path: string): string {
  if (path === '/' || path === '') return `${SITE_URL}/`;
  return `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}
