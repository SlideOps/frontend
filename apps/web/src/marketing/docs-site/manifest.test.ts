import { describe, expect, it } from 'vitest';
import { docsContent } from './content';
import { readHeadings, slugifyHeading } from './headings';
import { legacyDocsSlugs, resolveLegacyDocsPath } from './legacy';
import { DOCS_ROOT_PATH, docsNeighbours, docsPages, docsSections, findDocsPage } from './manifest';
import { searchDocs } from './search';

/*
 * The manifest is the one source of truth for what the docs contain and in what
 * order, so these are the properties everything else is entitled to assume:
 * that every page is addressable, that the order reads straight through, that
 * no retired address was forgotten, and that a heading's anchor is the anchor
 * the table of contents links to.
 */

describe('the documentation manifest', () => {
  it('gives every page a route of its own under the docs root', () => {
    const paths = docsPages.map((page) => page.path);
    expect(new Set(paths).size).toBe(docsPages.length);
    for (const path of paths) {
      expect(path.startsWith(`${DOCS_ROOT_PATH}/`)).toBe(true);
    }
  });

  it('finds every page by the section and slug in its own route', () => {
    for (const page of docsPages) {
      const [, , section, slug] = page.path.split('/');
      expect(findDocsPage(section, slug)).toBe(page);
    }
  });

  it('holds every page in exactly one section', () => {
    const counted = docsSections.flatMap((section) => section.pages);
    expect(counted).toHaveLength(docsPages.length);
    for (const section of docsSections) {
      for (const page of section.pages) {
        expect(page.section).toBe(section.id);
      }
    }
  });

  it('gives every page a title and a summary that say something', () => {
    for (const page of docsPages) {
      expect(page.title.trim().length).toBeGreaterThan(0);
      expect(page.summary.trim().length).toBeGreaterThan(0);
    }
  });

  it('has markdown behind every page it lists', () => {
    for (const page of docsPages) {
      expect(docsContent(page).trim().length).toBeGreaterThan(0);
    }
  });
});

describe('the links the prose hands a reader', () => {
  /** Every `/docs/...` target a page's markdown links to, in source order. */
  function docsLinksIn(markdown: string): string[] {
    const targets: string[] = [];
    for (const match of markdown.matchAll(/\]\((\/docs[^)\s]*)\)/g)) {
      targets.push(match[1]!);
    }
    return targets;
  }

  const anchorsByPath = new Map(
    docsPages.map((page) => [
      page.path,
      new Set(readHeadings(docsContent(page)).map((heading) => heading.id)),
    ]),
  );

  it('sends every internal link to a page that exists', () => {
    for (const page of docsPages) {
      for (const target of docsLinksIn(docsContent(page))) {
        const [path] = target.split('#');
        if (path === DOCS_ROOT_PATH || path === '') continue;
        expect(anchorsByPath.has(path!), `${page.contentKey} links to ${target}`).toBe(true);
      }
    }
  });

  it('sends every deep link to a heading that page actually has', () => {
    for (const page of docsPages) {
      for (const target of docsLinksIn(docsContent(page))) {
        const [path, fragment] = target.split('#');
        if (!fragment) continue;
        // A bare `#anchor` link points inside the page holding it.
        const anchors = anchorsByPath.get(path === '' ? page.path : path!);
        expect(anchors?.has(fragment), `${page.contentKey} links to ${target}`).toBe(true);
      }
    }
  });
});

describe('reading the docs straight through', () => {
  it('walks previous and next in the order the manifest declares', () => {
    docsPages.forEach((page, index) => {
      const { previous, next } = docsNeighbours(page);
      expect(previous?.contentKey).toBe(docsPages[index - 1]?.contentKey);
      expect(next?.contentKey).toBe(docsPages[index + 1]?.contentKey);
    });
  });

  it('offers no previous page at the beginning and no next page at the end', () => {
    expect(docsNeighbours(docsPages[0]!).previous).toBeUndefined();
    expect(docsNeighbours(docsPages[docsPages.length - 1]!).next).toBeUndefined();
  });
});

describe('addresses the first version of the docs handed out', () => {
  it('sends every retired slug to a page that still exists', () => {
    for (const slug of legacyDocsSlugs) {
      const target = resolveLegacyDocsPath(slug);
      expect(docsPages.some((page) => page.path === target)).toBe(true);
    }
  });

  it('sends a bare section name to the first page of that section', () => {
    for (const section of docsSections) {
      expect(resolveLegacyDocsPath(section.id)).toBe(section.pages[0]!.path);
    }
  });

  it('falls back to the documentation index for an address nobody recognises', () => {
    expect(resolveLegacyDocsPath('something-that-never-existed')).toBe(DOCS_ROOT_PATH);
    expect(resolveLegacyDocsPath(undefined)).toBe(DOCS_ROOT_PATH);
  });
});

describe('the anchors a page hands out', () => {
  it('turns a heading into a fragment made of its own words', () => {
    expect(slugifyHeading('Secure the server')).toBe('secure-the-server');
    expect(slugifyHeading('HTTPS, and why it renews itself')).toBe(
      'https-and-why-it-renews-itself',
    );
  });

  it('reads the same anchor for a heading however many times it is read', () => {
    const markdown = '## Verify\n\nSome prose.\n\n### Evidence\n\nMore prose.\n';
    expect(readHeadings(markdown)).toEqual(readHeadings(markdown));
    expect(readHeadings(markdown).map((heading) => heading.id)).toEqual(['verify', 'evidence']);
  });

  it('gives two headings worded the same an anchor each', () => {
    const markdown = '## Limits\n\nOne.\n\n## Limits\n\nTwo.\n';
    expect(readHeadings(markdown).map((heading) => heading.id)).toEqual(['limits', 'limits-2']);
  });

  it('never mistakes a comment inside a code block for a heading', () => {
    const markdown = '## Real heading\n\n```sh\n## not a heading\n```\n\n### Also real\n';
    expect(readHeadings(markdown).map((heading) => heading.text)).toEqual([
      'Real heading',
      'Also real',
    ]);
  });

  it('records the source line of each heading so a rendered heading can find its anchor', () => {
    const markdown = 'Intro line.\n\n## Second heading\n';
    expect(readHeadings(markdown)[0]!.line).toBe(3);
  });
});

describe('searching the docs', () => {
  it('finds a page by its title', () => {
    const results = searchDocs('glossary');
    expect(results[0]?.page.path).toBe(`${DOCS_ROOT_PATH}/reference/glossary`);
  });

  it('finds a page by words that appear only in its body, and quotes them back', () => {
    const results = searchDocs('non-root administrator');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]?.snippet.toLowerCase()).toContain('non-root administrator');
  });

  it('names the section a result belongs to', () => {
    const results = searchDocs('glossary');
    expect(results[0]?.sectionTitle).toBe('Reference');
  });

  it('says nothing at all until a query could mean something', () => {
    expect(searchDocs('')).toEqual([]);
    expect(searchDocs('a')).toEqual([]);
  });

  it('returns the same pages in the same order for the same query', () => {
    expect(searchDocs('server')).toEqual(searchDocs('server'));
  });
});
