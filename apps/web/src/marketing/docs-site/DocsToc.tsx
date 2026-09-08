import { useEffect, useState } from 'react';
import type { DocHeading } from './headings';

/*
 * On this page.
 *
 * Which entry is highlighted is decided by an IntersectionObserver watching the
 * real headings, rather than by arithmetic on scroll position, so it stays right
 * through a resize, a code block that grows and an image that finishes loading.
 * Where there is no observer, on a server render or in a test, the list still
 * renders and simply highlights nothing.
 */

/** Only headings above this margin from the top count as the section in view. */
const VIEWPORT_MARGIN = '-88px 0px -70% 0px';

export interface DocsTocProps {
  headings: readonly DocHeading[];
}

/** The table of contents for the page being read. */
export function DocsToc({ headings }: DocsTocProps) {
  const [activeId, setActiveId] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (headings.length === 0) return;
    if (typeof IntersectionObserver === 'undefined') return;

    const seen = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) seen.add(entry.target.id);
          else seen.delete(entry.target.id);
        }
        // The topmost heading still in the band is the one being read, so ties
        // resolve the same way whichever order the entries arrived in.
        const first = headings.find((heading) => seen.has(heading.id));
        if (first) setActiveId(first.id);
      },
      { rootMargin: VIEWPORT_MARGIN, threshold: 0 },
    );

    for (const heading of headings) {
      const element = document.getElementById(heading.id);
      if (element) observer.observe(element);
    }
    return () => observer.disconnect();
  }, [headings]);

  if (headings.length === 0) return null;

  return (
    <nav aria-label="On this page" className="text-sm">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-muted">
        On this page
      </p>
      <ul className="flex flex-col gap-1 border-l border-border">
        {headings.map((heading) => {
          const active = heading.id === activeId;
          return (
            <li key={heading.id}>
              <a
                href={`#${heading.id}`}
                aria-current={active ? 'true' : undefined}
                className={`-ml-px block border-l-2 py-1 pr-2 transition-colors duration-fast ease-standard focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus ${
                  heading.level === 3 ? 'pl-6' : 'pl-3'
                } ${active ? 'border-brand text-ink' : 'border-transparent text-ink-muted hover:text-ink'}`}
              >
                {heading.text}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
