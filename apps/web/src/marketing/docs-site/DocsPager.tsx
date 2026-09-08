import { ArrowLeft, ArrowRight } from '@slideops/icons';
import { Link } from 'react-router-dom';
import { docsNeighbours, type DocsPageEntry } from './manifest';

/*
 * Previous and next.
 *
 * The order is the manifest's, which is the order the docs are written to be
 * read in, so somebody who starts at the top can reach the end without ever
 * going back to the navigation. The first page has no previous and the last has
 * no next: an inert control there would only look broken.
 */

export interface DocsPagerProps {
  page: DocsPageEntry;
}

/** The links to the pages either side of this one. */
export function DocsPager({ page }: DocsPagerProps) {
  const { previous, next } = docsNeighbours(page);
  if (!previous && !next) return null;

  return (
    <nav
      aria-label="Previous and next page"
      className="mt-16 grid gap-3 border-t border-border pt-8 sm:grid-cols-2"
    >
      {previous ? (
        <Link
          to={previous.path}
          rel="prev"
          className="group flex flex-col gap-1 rounded-lg border border-border bg-surface p-4 transition-colors duration-fast ease-standard hover:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        >
          <span className="inline-flex items-center gap-1.5 text-xs text-ink-muted">
            <ArrowLeft width={13} height={13} aria-hidden />
            Previous
          </span>
          <span className="text-sm font-medium text-ink">{previous.title}</span>
        </Link>
      ) : (
        <span aria-hidden className="hidden sm:block" />
      )}

      {next ? (
        <Link
          to={next.path}
          rel="next"
          className="group flex flex-col gap-1 rounded-lg border border-border bg-surface p-4 text-right transition-colors duration-fast ease-standard hover:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus sm:col-start-2"
        >
          <span className="inline-flex items-center justify-end gap-1.5 text-xs text-ink-muted">
            Next
            <ArrowRight width={13} height={13} aria-hidden />
          </span>
          <span className="text-sm font-medium text-ink">{next.title}</span>
        </Link>
      ) : null}
    </nav>
  );
}
