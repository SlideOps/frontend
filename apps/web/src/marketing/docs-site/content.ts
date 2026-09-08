import { docsPages, type DocsPageEntry } from './manifest';

/*
 * The markdown behind every documentation page.
 *
 * The files are pulled in eagerly rather than fetched. The docs are a public
 * marketing surface with no backend behind them, and loading every page up
 * front is what lets search run over the real prose and lets a page paint with
 * its final height, so moving between pages never shifts the layout.
 */
const files = import.meta.glob('../docs/**/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const byKey = new Map<string, string>();
for (const [filePath, raw] of Object.entries(files)) {
  const key = filePath.replace(/^\.\.\/docs\//, '').replace(/\.md$/, '');
  byKey.set(key, raw);
}

/**
 * The markdown for a page, or an empty string when its file is not there yet.
 *
 * A missing file is never an error. The manifest is the source of truth for
 * what the docs contain, so a page can be listed and routed while its prose is
 * still being written.
 */
export function docsContent(page: DocsPageEntry): string {
  return byKey.get(page.contentKey) ?? '';
}

/** True when a page has prose behind it. */
export function docsHasContent(page: DocsPageEntry): boolean {
  return docsContent(page).trim().length > 0;
}

/** Every page paired with its markdown, in manifest order. */
export function allDocsContent(): { page: DocsPageEntry; markdown: string }[] {
  return docsPages.map((page) => ({ page, markdown: docsContent(page) }));
}
