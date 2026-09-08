/** The documentation site: its frame, its routes, and the manifest behind both. */
export { DocsShell, DocsNotFound } from './DocsShell';
export { DocsHome } from './DocsHome';
export { DocsArticle } from './DocsArticle';
export { DocsLegacyRedirect } from './DocsLegacyRedirect';
export { docsRoutes } from './routes';
export { DocsSearch } from './DocsSearch';
export { DocsNav } from './DocsNav';
export { DocsToc } from './DocsToc';
export { DocsPager } from './DocsPager';
export { DocsMarkdown } from './DocsMarkdown';
export {
  docsSections,
  docsPages,
  docsFirstPage,
  docsNeighbours,
  findDocsPage,
  findDocsSection,
  DOCS_ROOT_PATH,
  type DocsPageEntry,
  type DocsSection,
  type DocsSectionId,
} from './manifest';
export { docsContent, docsHasContent, allDocsContent } from './content';
export { readHeadings, slugifyHeading, type DocHeading } from './headings';
export { searchDocs, type DocsSearchResult } from './search';
export { resolveLegacyDocsPath, isLegacyDocsSlug, legacyDocsSlugs } from './legacy';
