import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { legacyDocsSlugs, resolveLegacyDocsPath } from '../marketing/docs-site/legacy';
import { docsPages, docsSections } from '../marketing/docs-site/manifest';
import { llmsFullTxt, llmsTxt, robotsTxt, sitemapXml } from './files';
import {
  firstParagraph,
  headFor,
  normalizePath,
  publicPages,
  renderHeadHtml,
  summarize,
} from './head';
import { SITE_URL } from './site';

/*
 * What search engines are told, checked the way they read it: one canonical
 * URL per page, a title and description of its own, noindex wherever a page is
 * nobody's search result, and a sitemap, robots.txt and hosting config that
 * agree with the page registry rather than with a second list somebody has to
 * remember to update.
 */

function tag(pathname: string, predicate: (attrs: Readonly<Record<string, string>>) => boolean) {
  return headFor(pathname).tags.find((entry) => predicate(entry.attrs));
}

describe('the public page registry', () => {
  it('lists every documentation page, once', () => {
    const paths = publicPages.map((page) => page.path);
    for (const page of docsPages) expect(paths).toContain(page.path);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it('gives every page its own title and a description that fits a search result', () => {
    const titles = publicPages.map((page) => page.title);
    expect(new Set(titles).size).toBe(titles.length);
    for (const page of publicPages) {
      expect(page.title.trim(), page.path).not.toBe('');
      expect(page.description.length, page.path).toBeGreaterThanOrEqual(50);
      expect(page.description.length, page.path).toBeLessThanOrEqual(200);
    }
  });

  it('writes no dash where a sentence belongs', () => {
    for (const page of publicPages) {
      expect(`${page.title} ${page.description}`, page.path).not.toMatch(/[–—]/);
    }
  });
});

describe('the head for an address', () => {
  it('points a public page at its one canonical URL on the canonical host', () => {
    const canonical = tag('/docs/start/quick-start', (attrs) => attrs.rel === 'canonical');
    expect(canonical?.attrs.href).toBe(`${SITE_URL}/docs/start/quick-start`);
    expect(tag('/', (attrs) => attrs.rel === 'canonical')?.attrs.href).toBe(`${SITE_URL}/`);
  });

  it('treats a trailing slash, a query and a hash as the same page', () => {
    expect(normalizePath('/pricing/')).toBe('/pricing');
    expect(normalizePath('/pricing?ref=x#tiers')).toBe('/pricing');
    expect(headFor('/pricing/').title).toBe(headFor('/pricing').title);
  });

  it('keeps the signed-in areas and one-time links out of search results', () => {
    for (const path of ['/app', '/app/nodes/1', '/admin', '/admin/audit', '/login', '/register', '/mfa', '/invitations/abc', '/node-transfers/abc']) {
      const robots = tag(path, (attrs) => attrs.name === 'robots');
      expect(robots?.attrs.content, path).toContain('noindex');
      expect(tag(path, (attrs) => attrs.rel === 'canonical'), path).toBeUndefined();
    }
  });

  it('marks an unknown address as not found, and never as a listing', () => {
    const head = headFor('/no-such-page');
    expect(head.title).toMatch(/not found/i);
    expect(tag('/no-such-page', (attrs) => attrs.name === 'robots')?.attrs.content).toContain('noindex');
  });

  it('publishes structured data that is valid JSON and cannot close its script early', () => {
    const html = renderHeadHtml(headFor('/'));
    const json = html.match(/<script type="application\/ld\+json" data-seo>([\s\S]*?)<\/script>/)?.[1];
    expect(json).toBeDefined();
    const graph = JSON.parse(json!.replace(/\\u003c/g, '<'))['@graph'] as { '@type': string }[];
    expect(graph.map((node) => node['@type'])).toEqual(
      expect.arrayContaining(['Organization', 'WebSite', 'SoftwareApplication', 'FAQPage']),
    );
    expect(json).not.toContain('</');
  });
});

describe('a documentation page description', () => {
  it('is the opening paragraph, as plain text', () => {
    expect(firstParagraph('# Title\n\nSee [the docs](/docs) and `ssh`, **now**.\n\n## Next')).toBe(
      'See the docs and ssh, now.',
    );
  });

  it('is cut to fit, at a sentence when one fits', () => {
    const long = `${'A sentence that goes on. '.repeat(10)}`;
    const cut = summarize(long, 100);
    expect(cut.length).toBeLessThanOrEqual(100);
    expect(cut.endsWith('.')).toBe(true);
  });
});

describe('the files crawlers ask for by name', () => {
  it('robots.txt names the sitemap and stays out of the signed-in areas', () => {
    const robots = robotsTxt();
    expect(robots).toContain(`Sitemap: ${SITE_URL}/sitemap.xml`);
    expect(robots).toContain('Disallow: /app/');
    expect(robots).toContain('Disallow: /admin/');
    expect(robots).not.toMatch(/^Disallow: \/$/m);
  });

  it('the sitemap lists every public page and nothing private', () => {
    const sitemap = sitemapXml();
    for (const page of publicPages) {
      const loc = page.path === '/' ? `${SITE_URL}/` : `${SITE_URL}${page.path}`;
      expect(sitemap).toContain(`<loc>${loc}</loc>`);
    }
    expect(sitemap).not.toMatch(/\/(app|admin|login|register)\b/);
  });

  it('llms.txt links every documentation page, and llms-full.txt carries its prose', () => {
    const index = llmsTxt();
    const full = llmsFullTxt();
    for (const section of docsSections) {
      for (const page of section.pages) expect(index).toContain(`${SITE_URL}${page.path}`);
    }
    expect(full).toContain(`Source: ${SITE_URL}/docs/start/quick-start`);
  });
});

describe('the hosting config', () => {
  const config = JSON.parse(readFileSync(new URL('../../vercel.json', import.meta.url), 'utf8')) as {
    redirects: { source: string; destination: string; permanent: boolean }[];
    rewrites: { source: string; destination: string }[];
  };

  it('redirects every retired docs address where the app itself would send it, permanently', () => {
    const sources = [...legacyDocsSlugs, ...docsSections.map((section) => section.id)];
    for (const slug of sources) {
      const rule = config.redirects.find((entry) => entry.source === `/docs/${slug}`);
      expect(rule, slug).toBeDefined();
      expect(rule?.destination, slug).toBe(resolveLegacyDocsPath(slug));
      expect(rule?.permanent, slug).toBe(true);
    }
  });

  it('serves the app shell for the signed-in areas, and nothing else', () => {
    // With cleanUrls on, Vercel serves app-shell.html at /app-shell and not at
    // /app-shell.html, so a rewrite must name the clean path or it 404s.
    for (const rule of config.rewrites) expect(rule.destination).toBe('/app-shell');
    const sources = config.rewrites.map((rule) => rule.source);
    expect(sources).toEqual(expect.arrayContaining(['/app/:path*', '/admin/:path*', '/login', '/register']));
    expect(sources.some((source) => source === '/(.*)' || source.startsWith('/docs'))).toBe(false);
  });
});
