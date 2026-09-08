import { DOCS_ROOT_PATH, findDocsSection } from './manifest';

/*
 * Where the old documentation slugs went.
 *
 * The first version of the docs was six pages selected inside a single /docs
 * screen, linked as /docs#getting-started and shared as such. Those links are in
 * bookmarks, in chat histories and in the footer of every email that ever
 * pointed somebody at the docs, so each one still resolves to the page that now
 * holds that material rather than dropping a reader on a landing page with no
 * explanation.
 */
const legacyTargets: Record<string, string> = {
  'getting-started': `${DOCS_ROOT_PATH}/start/quick-start`,
  'servers-and-projects': `${DOCS_ROOT_PATH}/infrastructure/servers`,
  'how-an-operation-works': `${DOCS_ROOT_PATH}/start/how-an-operation-works`,
  'deployment-methods': `${DOCS_ROOT_PATH}/build/deploying`,
  'managing-what-you-installed': `${DOCS_ROOT_PATH}/infrastructure/capabilities`,
  'day-to-day': `${DOCS_ROOT_PATH}/observe/activity`,
};

/**
 * The route an old docs slug now leads to.
 *
 * Falls back through three answers so nothing under /docs ever dead ends: a
 * retired slug goes to the page that absorbed it, a bare section id goes to the
 * first page of that section, and anything else goes to the docs landing page.
 */
export function resolveLegacyDocsPath(slug: string | undefined): string {
  if (!slug) return DOCS_ROOT_PATH;

  const target = legacyTargets[slug];
  if (target) return target;

  const section = findDocsSection(slug);
  if (section && section.pages.length > 0) return section.pages[0]!.path;

  return DOCS_ROOT_PATH;
}

/** True when this slug is one of the retired page names. */
export function isLegacyDocsSlug(slug: string): boolean {
  return slug in legacyTargets;
}

/** Every retired slug, for the tests that prove none of them was forgotten. */
export const legacyDocsSlugs: readonly string[] = Object.keys(legacyTargets);
