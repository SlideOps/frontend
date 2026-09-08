import { Text } from '@slideops/design-system';
import { ChevronRight } from '@slideops/icons';
import { useEffect } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { docsContent } from './content';
import { DocsMarkdown } from './DocsMarkdown';
import { DocsPager } from './DocsPager';
import { DocsNotFound } from './DocsShell';
import { findDocsPage, findDocsSection, DOCS_ROOT_PATH } from './manifest';

/*
 * One documentation page.
 *
 * The title and the line under it come from the manifest rather than from the
 * markdown, so a page announces itself correctly while its prose is still being
 * written, and so what the navigation calls a page is always what the page calls
 * itself.
 */

/**
 * Scroll to the heading a deep link named, once the prose is on the page.
 *
 * The hash comes from the router rather than from window.location, because the
 * router is what actually decided which page is showing, and a page reached by
 * a client side link changes the router's location before the address bar's.
 */
function useAnchorScroll(key: string, hash: string) {
  useEffect(() => {
    if (!hash || hash.length < 2) {
      if (typeof window.scrollTo === 'function') window.scrollTo({ top: 0 });
      return;
    }
    const target = document.getElementById(decodeURIComponent(hash.slice(1)));
    // Guarded because scrolling an element into view is a browser affordance
    // that a test environment does not have to provide.
    if (target && typeof target.scrollIntoView === 'function') target.scrollIntoView();
  }, [key, hash]);
}

/** The page named by the route, or a way back when the route names none. */
export function DocsArticle() {
  const params = useParams();
  const location = useLocation();
  const page = findDocsPage(params.section, params.page);
  useAnchorScroll(page?.contentKey ?? '', location.hash);

  if (!page) return <DocsNotFound />;

  const section = findDocsSection(page.section);
  const markdown = docsContent(page);

  return (
    <article className="max-w-[72ch]">
      <nav
        aria-label="Breadcrumb"
        className="mb-4 flex items-center gap-1.5 text-xs text-ink-muted"
      >
        <Link
          to={DOCS_ROOT_PATH}
          className="rounded transition-colors duration-fast ease-standard hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        >
          Docs
        </Link>
        <ChevronRight width={12} height={12} aria-hidden />
        <span>{section?.title}</span>
      </nav>

      <header className="mb-8">
        <Text as="h1" variant="h1">
          {page.title}
        </Text>
        <Text variant="body" tone="secondary" className="mt-3">
          {page.summary}
        </Text>
      </header>

      {markdown.trim().length > 0 ? (
        <DocsMarkdown markdown={markdown} />
      ) : (
        <Text variant="body" tone="secondary">
          This page is being written. Everything around it already works, so it will fill in here.
        </Text>
      )}

      <DocsPager page={page} />
    </article>
  );
}
