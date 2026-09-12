import { docsContent } from '../marketing/docs-site/content';
import { docsSections } from '../marketing/docs-site/manifest';
import { publicPages } from './head';
import { absoluteUrl, DEFAULT_DESCRIPTION, SITE_NAME, SITE_URL } from './site';

/*
 * The plain files a crawler asks for by name: robots.txt, sitemap.xml, and the
 * two llms.txt files that answer engines read. Each is built from the same page
 * registry as the head tags, at build time, so a page added to the docs manifest
 * is in all of them on the next deploy without anybody editing a list.
 */

/** robots.txt: crawl the public site, stay out of the signed-in areas. */
export function robotsTxt(): string {
  return [
    `# ${SITE_URL}/robots.txt`,
    '# The public site and the documentation are open to every crawler. The',
    '# signed-in areas and one-time links are not search results.',
    'User-agent: *',
    'Allow: /',
    'Disallow: /app/',
    'Disallow: /admin/',
    'Disallow: /api/',
    'Disallow: /invitations/',
    'Disallow: /node-transfers/',
    '',
    `Sitemap: ${SITE_URL}/sitemap.xml`,
    '',
  ].join('\n');
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/*
 * No lastmod: the build has no trustworthy date for when a page's content last
 * changed, and a date that moves on every deploy teaches search engines to
 * ignore it.
 */
/** sitemap.xml: every public page's canonical URL, and nothing else. */
export function sitemapXml(): string {
  const urls = publicPages
    .map((page) => `  <url>\n    <loc>${escapeXml(absoluteUrl(page.path))}</loc>\n  </url>`)
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

/**
 * llms.txt: what SlideOps is and where each answer lives, in the llmstxt.org
 * shape, so an answer engine can cite a page instead of guessing.
 */
export function llmsTxt(): string {
  const page = (path: string) => publicPages.find((entry) => entry.path === path);
  const product = ['/', '/story', '/capabilities', '/audience', '/pricing']
    .map((path) => page(path))
    .filter((entry) => entry !== undefined)
    .map((entry) => `- [${entry.title}](${absoluteUrl(entry.path)}): ${entry.description}`);

  const docs = docsSections.flatMap((section) => [
    '',
    `### ${section.title}`,
    '',
    ...section.pages.map((entry) => `- [${entry.title}](${absoluteUrl(entry.path)}): ${entry.summary}`),
  ]);

  return [
    `# ${SITE_NAME}`,
    '',
    `> ${DEFAULT_DESCRIPTION}`,
    '',
    'SlideOps connects to Linux servers you own over SSH. You describe the outcome you want as a Capability, SlideOps plans how to reach it on your platform, and nothing runs until you approve the plan. Each Operation is then verified, and recorded in History. You keep ownership of the servers; SlideOps orchestrates and explains the tools already on them.',
    '',
    '## Product',
    '',
    ...product,
    '',
    '## Documentation',
    ...docs,
    '',
    '## Optional',
    '',
    `- [The whole documentation as one file](${absoluteUrl('/llms-full.txt')}): every page above, in reading order.`,
    '',
  ].join('\n');
}

/** llms-full.txt: every documentation page's markdown, with its canonical URL. */
export function llmsFullTxt(): string {
  const parts = [`# ${SITE_NAME} documentation`, '', `> ${DEFAULT_DESCRIPTION}`, ''];
  for (const section of docsSections) {
    for (const entry of section.pages) {
      const markdown = docsContent(entry).trim();
      if (!markdown) continue;
      parts.push('---', '', `Source: ${absoluteUrl(entry.path)}`, `Section: ${section.title}`, '', markdown, '');
    }
  }
  return `${parts.join('\n')}\n`;
}
