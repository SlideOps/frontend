import { allDocsContent } from './content';
import { readHeadings } from './headings';
import { findDocsSection, type DocsPageEntry } from './manifest';

/*
 * Search across the docs, entirely in the browser.
 *
 * The docs are public and have no backend, so the index is built once from the
 * markdown already bundled with the page. A title match outranks a heading
 * match, which outranks the body, because somebody typing a page's name almost
 * always wants that page rather than the twelve pages that mention it.
 */

/** One page, prepared for matching. */
interface IndexedPage {
  readonly page: DocsPageEntry;
  readonly sectionTitle: string;
  readonly title: string;
  readonly summary: string;
  readonly headings: readonly string[];
  /** The prose with its markdown syntax removed, kept for snippets. */
  readonly body: string;
  readonly lowerTitle: string;
  readonly lowerSummary: string;
  readonly lowerHeadings: string;
  readonly lowerBody: string;
}

/** A page that matched, with the words around the match. */
export interface DocsSearchResult {
  readonly page: DocsPageEntry;
  readonly sectionTitle: string;
  /** The heading that matched, when the match was in one. */
  readonly heading: string | undefined;
  /** A short run of the page's own words around the match. */
  readonly snippet: string;
  readonly score: number;
}

const SNIPPET_BEFORE = 40;
const SNIPPET_LENGTH = 160;
const DEFAULT_LIMIT = 8;

const TITLE_SCORE = 100;
const TITLE_PREFIX_BONUS = 40;
const HEADING_SCORE = 30;
const SUMMARY_SCORE = 20;
const BODY_SCORE = 8;

/** Reduce markdown to the words a reader would see, so snippets read cleanly. */
function toPlainProse(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s{0,3}>\s?/gm, '')
    .replace(/^\s{0,3}[-*+]\s+/gm, '')
    .replace(/[*_]{1,3}([^*_]+)[*_]{1,3}/g, '$1')
    .replace(/\|/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

let index: IndexedPage[] | undefined;

/** The index, built on first use and reused afterwards. */
function docsIndex(): IndexedPage[] {
  if (index) return index;
  index = allDocsContent().map(({ page, markdown }) => {
    const headings = readHeadings(markdown).map((heading) => heading.text);
    const body = toPlainProse(markdown);
    return {
      page,
      sectionTitle: findDocsSection(page.section)?.title ?? '',
      title: page.title,
      summary: page.summary,
      headings,
      body,
      lowerTitle: page.title.toLowerCase(),
      lowerSummary: page.summary.toLowerCase(),
      lowerHeadings: headings.join(' \n ').toLowerCase(),
      lowerBody: body.toLowerCase(),
    };
  });
  return index;
}

/** Words around the first occurrence, trimmed to whole words and ellipsed. */
function snippetAround(text: string, at: number, queryLength: number): string {
  if (text.length === 0) return '';
  if (at < 0) return text.slice(0, SNIPPET_LENGTH).trim();

  let start = Math.max(0, at - SNIPPET_BEFORE);
  let end = Math.min(text.length, start + Math.max(SNIPPET_LENGTH, queryLength + 40));
  if (start > 0) {
    const space = text.indexOf(' ', start);
    if (space >= 0 && space < at) start = space + 1;
  }
  if (end < text.length) {
    const space = text.lastIndexOf(' ', end);
    if (space > at + queryLength) end = space;
  }
  return `${start > 0 ? '…' : ''}${text.slice(start, end).trim()}${end < text.length ? '…' : ''}`;
}

/**
 * Pages matching a query, best first.
 *
 * An empty or single-character query returns nothing rather than everything: a
 * results list that appears on the first keystroke is noise, not help.
 */
export function searchDocs(query: string, limit = DEFAULT_LIMIT): DocsSearchResult[] {
  const needle = query.trim().toLowerCase();
  if (needle.length < 2) return [];

  const results: DocsSearchResult[] = [];

  for (const entry of docsIndex()) {
    let score = 0;
    let heading: string | undefined;
    let snippet = '';

    if (entry.lowerTitle.includes(needle)) {
      score += TITLE_SCORE;
      if (entry.lowerTitle.startsWith(needle)) score += TITLE_PREFIX_BONUS;
      snippet = entry.summary;
    }

    const headingHit = entry.headings.find((text) => text.toLowerCase().includes(needle));
    if (headingHit) {
      score += HEADING_SCORE;
      heading = headingHit;
    }

    if (entry.lowerSummary.includes(needle)) {
      score += SUMMARY_SCORE;
      if (!snippet) snippet = entry.summary;
    }

    const bodyAt = entry.lowerBody.indexOf(needle);
    if (bodyAt >= 0) {
      score += BODY_SCORE;
      if (!snippet) snippet = snippetAround(entry.body, bodyAt, needle.length);
    }

    if (score === 0) continue;
    if (!snippet) snippet = entry.summary;

    results.push({
      page: entry.page,
      sectionTitle: entry.sectionTitle,
      heading,
      snippet,
      score,
    });
  }

  // Ties fall back to manifest order, which docsIndex preserves, so the same
  // query always produces the same list in the same order.
  return results.sort((a, b) => b.score - a.score).slice(0, limit);
}
