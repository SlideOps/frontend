import { ChevronDown } from '@slideops/icons';
import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { docsSections, type DocsPageEntry, type DocsSectionId } from './manifest';

/*
 * The section navigation.
 *
 * Only the group holding the page being read is open to begin with, so the
 * whole table of contents does not arrive as a wall of twenty nine links. A
 * group a reader opens stays open while they browse, and arriving on a page
 * always opens its group, so the current page is never hidden inside a
 * collapsed section.
 */

export interface DocsNavProps {
  /** The page being read, when one is open. */
  current: DocsPageEntry | undefined;
  /** How this copy of the navigation is labelled for assistive technology. */
  label: string;
  /** Called after a link is followed, so a phone can close its disclosure. */
  onNavigate?: () => void;
}

/** The grouped, collapsible list of every documentation page. */
export function DocsNav({ current, label, onNavigate }: DocsNavProps) {
  const [open, setOpen] = useState<ReadonlySet<DocsSectionId>>(() =>
    current ? new Set([current.section]) : new Set([docsSections[0]!.id]),
  );

  useEffect(() => {
    if (!current) return;
    setOpen((previous) => {
      if (previous.has(current.section)) return previous;
      const next = new Set(previous);
      next.add(current.section);
      return next;
    });
  }, [current]);

  function toggle(id: DocsSectionId) {
    setOpen((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <nav aria-label={label} className="flex flex-col gap-1">
      {docsSections.map((section) => {
        const expanded = open.has(section.id);
        const listId = `docs-nav-${label.replace(/\s+/g, '-').toLowerCase()}-${section.id}`;
        return (
          <div key={section.id}>
            <button
              type="button"
              onClick={() => toggle(section.id)}
              aria-expanded={expanded}
              aria-controls={listId}
              className="flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-ink-muted transition-colors duration-fast ease-standard hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            >
              {section.title}
              <ChevronDown
                width={14}
                height={14}
                aria-hidden
                className={`shrink-0 transition-transform duration-fast ease-standard ${
                  expanded ? '' : '-rotate-90'
                }`}
              />
            </button>
            <ul id={listId} hidden={!expanded} className="mb-2 flex flex-col gap-0.5 pl-1">
              {section.pages.map((page) => (
                <li key={page.contentKey}>
                  <NavLink
                    to={page.path}
                    onClick={onNavigate}
                    end
                    className={({ isActive }) =>
                      `block rounded-md border-l-2 py-1.5 pl-3 pr-2 text-sm transition-colors duration-fast ease-standard focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus ${
                        isActive
                          ? 'border-brand bg-subtle font-medium text-ink'
                          : 'border-transparent text-ink-muted hover:border-border hover:text-ink'
                      }`
                    }
                  >
                    {page.title}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}
