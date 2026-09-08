import { Text } from '@slideops/design-system';
import { ArrowRight } from '@slideops/icons';
import { useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { resolveLegacyDocsPath } from './legacy';
import { docsFirstPage, docsSections, DOCS_ROOT_PATH } from './manifest';

/*
 * The documentation landing page.
 *
 * Every section, every page, and the line each one answers, on one screen. It is
 * a map rather than a welcome: somebody who opened the docs has a question, and
 * the fastest thing this page can do is show them which page holds the answer.
 */

/** Honour the anchors the first version of the docs handed out. */
function useLegacyAnchorRedirect() {
  const location = useLocation();
  const navigate = useNavigate();
  const hash = location.hash;

  useEffect(() => {
    if (!hash || hash.length < 2) return;
    const slug = decodeURIComponent(hash.slice(1));
    const target = resolveLegacyDocsPath(slug);
    if (target !== DOCS_ROOT_PATH) navigate(target, { replace: true });
  }, [hash, navigate]);
}

/** The index of every documentation page. */
export function DocsHome() {
  useLegacyAnchorRedirect();

  return (
    <div className="min-w-0">
      <header className="max-w-[62ch]">
        <Text variant="caption" tone="accent">
          Documentation
        </Text>
        <Text as="h1" variant="h1" className="mt-3">
          Secure your servers, then run Projects on them
        </Text>
        <Text variant="body" tone="secondary" className="mt-5">
          How SlideOps works, in plain language: connect and secure a server, create Projects,
          install only what each one needs, and deploy. Read it straight through, or take the one
          page that answers your question.
        </Text>
        <Link
          to={docsFirstPage.path}
          className="mt-6 inline-flex items-center gap-2 rounded-md text-sm font-medium text-accent transition-colors duration-fast ease-standard hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        >
          Start at the beginning
          <ArrowRight width={15} height={15} aria-hidden />
        </Link>
      </header>

      <div className="mt-12 grid gap-x-10 gap-y-10 sm:grid-cols-2">
        {docsSections.map((section) => (
          <section key={section.id} aria-labelledby={`docs-index-${section.id}`}>
            <Text
              as="h2"
              variant="caption"
              tone="secondary"
              id={`docs-index-${section.id}`}
              className="font-semibold"
            >
              {section.title}
            </Text>
            <ul className="mt-3 flex flex-col">
              {section.pages.map((page) => (
                <li key={page.contentKey}>
                  <Link
                    to={page.path}
                    className="group -mx-3 block rounded-lg px-3 py-2.5 transition-colors duration-fast ease-standard hover:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                  >
                    <span className="block text-sm font-medium text-ink">{page.title}</span>
                    <span className="mt-0.5 block text-sm text-ink-muted">{page.summary}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
