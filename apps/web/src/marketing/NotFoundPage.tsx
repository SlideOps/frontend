import { Text } from '@slideops/design-system';
import { ArrowRight, BookOpen } from '@slideops/icons';
import { Link } from 'react-router-dom';

/**
 * An address the site has no page for.
 *
 * It says so, rather than quietly showing the home page at the wrong address.
 * The published build serves this same page with a real 404 status, so a search
 * engine drops a dead link instead of indexing a copy of the home page under it.
 */
export function NotFoundPage() {
  return (
    <section className="mx-auto max-w-3xl px-6 py-24 md:py-32">
      <Text variant="caption" tone="accent">
        404
      </Text>
      <Text as="h1" variant="h1" className="mt-3">
        There is no page at this address
      </Text>
      <Text variant="body" tone="secondary" className="mt-5">
        It may have been mistyped, or the page may have moved. Everything SlideOps publishes is
        reachable from the home page and the documentation.
      </Text>
      <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-sm font-medium">
        <Link
          to="/"
          className="inline-flex items-center gap-2 rounded-md text-accent transition-colors duration-fast ease-standard hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        >
          <ArrowRight width={15} height={15} aria-hidden />
          Go to the home page
        </Link>
        <Link
          to="/docs"
          className="inline-flex items-center gap-2 rounded-md text-accent transition-colors duration-fast ease-standard hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        >
          <BookOpen width={15} height={15} aria-hidden />
          Browse the documentation
        </Link>
      </div>
    </section>
  );
}
