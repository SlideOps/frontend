import { Text } from '@slideops/design-system';
import { BookOpen, ChevronDown } from '@slideops/icons';
import { useEffect, useMemo, useState } from 'react';
import { Link, Outlet, useLocation, useParams } from 'react-router-dom';
import { docsContent } from './content';
import { DocsNav } from './DocsNav';
import { DocsSearch } from './DocsSearch';
import { DocsToc } from './DocsToc';
import { readHeadings } from './headings';
import { DOCS_ROOT_PATH, findDocsPage } from './manifest';

/*
 * The documentation frame.
 *
 * Three columns on a wide screen: sections on the left, the page in the middle,
 * and what is on that page on the right. The right column folds away first,
 * because it is a convenience; the left folds into a disclosure only on a phone,
 * because without it there is no way to reach another page. The middle column is
 * held to a reading measure rather than filling the window, since a line of
 * prose the width of a monitor is unreadable however good the prose is.
 */

/** The frame every documentation route renders inside. */
export function DocsShell() {
  const params = useParams();
  const location = useLocation();
  const current = findDocsPage(params.section, params.page);
  const [navOpen, setNavOpen] = useState(false);

  /*
   * The table of contents is built here rather than inside the page, so the
   * right column is part of the frame and never arrives a beat after the prose.
   * Both read the same manifest entry, so the two cannot disagree.
   */
  const headings = useMemo(() => (current ? readHeadings(docsContent(current)) : []), [current]);

  /*
   * The index has no headings of its own to list, so it takes the third column
   * back and lays its map of the docs across the width instead of leaving a
   * pane of nothing beside it.
   */
  const columns = current
    ? 'md:grid-cols-[14rem_minmax(0,1fr)] xl:grid-cols-[15rem_minmax(0,42rem)_minmax(0,1fr)]'
    : 'md:grid-cols-[14rem_minmax(0,1fr)]';

  // The phone disclosure closes on arrival, so following a link shows the page
  // rather than the list the reader just used.
  useEffect(() => {
    setNavOpen(false);
  }, [location.pathname]);

  return (
    <div>
      <div className="mx-auto max-w-[80rem] px-6">
        {/* The middle column is capped rather than stretched, so what is left
            over on a very wide screen falls to the outer columns instead of
            pulling a line of prose past the width anybody can read. */}
        <div className={`grid gap-x-8 xl:gap-x-12 ${columns}`}>
          {/* Sections. A sidebar from the tablet breakpoint up. */}
          <aside className="hidden md:block">
            <div className="sticky top-16 max-h-[calc(100dvh-4rem)] overflow-y-auto py-10 pr-2">
              <Link
                to={DOCS_ROOT_PATH}
                className="mb-5 inline-flex items-center gap-2 rounded-md text-sm font-medium text-ink transition-colors duration-fast ease-standard hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
              >
                <BookOpen width={15} height={15} aria-hidden />
                Documentation
              </Link>
              <DocsSearch className="mb-5" />
              <DocsNav current={current} label="Documentation" />
            </div>
          </aside>

          {/* The page. */}
          <div className="min-w-0 py-10">
            {/* Sections, on a phone, where there is no room for a column. */}
            <div className="mb-8 md:hidden">
              <DocsSearch className="mb-3" />
              <button
                type="button"
                onClick={() => setNavOpen((open) => !open)}
                aria-expanded={navOpen}
                aria-controls="docs-mobile-nav"
                className="flex w-full items-center justify-between gap-2 rounded-lg border border-border bg-surface px-4 py-2.5 text-sm font-medium text-ink transition-colors duration-fast ease-standard hover:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
              >
                <span className="inline-flex items-center gap-2">
                  <BookOpen width={15} height={15} aria-hidden />
                  {current ? current.title : 'Browse the documentation'}
                </span>
                <ChevronDown
                  width={15}
                  height={15}
                  aria-hidden
                  className={`shrink-0 transition-transform duration-fast ease-standard ${
                    navOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>
              <div
                id="docs-mobile-nav"
                hidden={!navOpen}
                className="mt-2 rounded-lg border border-border bg-surface p-2"
              >
                <DocsNav
                  current={current}
                  label="Documentation sections"
                  onNavigate={() => setNavOpen(false)}
                />
              </div>
            </div>

            <Outlet />
          </div>

          {/* On this page. Folds away first, being the one column a reader can
              do without. */}
          {current ? (
            <aside className="hidden xl:block">
              <div className="sticky top-16 max-h-[calc(100dvh-4rem)] max-w-[16rem] overflow-y-auto py-10 pl-2">
                <DocsToc headings={headings} />
              </div>
            </aside>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** A route under /docs that names no page the manifest knows. */
export function DocsNotFound() {
  return (
    <div className="max-w-[72ch]">
      <Text as="h1" variant="h1">
        That page has moved
      </Text>
      <Text variant="body" tone="secondary" className="mt-4">
        Nothing lives at this address any more. The documentation index lists every page.
      </Text>
      <Link
        to={DOCS_ROOT_PATH}
        className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-accent hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
      >
        <BookOpen width={15} height={15} aria-hidden />
        Back to the documentation
      </Link>
    </div>
  );
}
