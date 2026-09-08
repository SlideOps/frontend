import { Search } from '@slideops/icons';
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { searchDocs } from './search';

/*
 * Searching the docs.
 *
 * A combobox over a listbox, so it behaves the way a reader already expects:
 * type, walk the results with the arrow keys, open one with Enter, dismiss with
 * Escape. The keyboard is the point rather than an accommodation, because this
 * is how anybody who reads docs often actually moves through them. Everything
 * matches in the browser against markdown already loaded, so there is no request
 * behind a keystroke.
 */

export interface DocsSearchProps {
  /** Placeholder and accessible name, so the landing page can ask louder. */
  label?: string;
  className?: string;
}

/** Search across every documentation page, by title, heading and body. */
export function DocsSearch({ label = 'Search the docs', className }: DocsSearchProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();

  const results = useMemo(() => searchDocs(query), [query]);
  const open = !dismissed && query.trim().length >= 2;

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  // A click anywhere else means the reader is done with the results.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setDismissed(true);
    }
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  function goTo(index: number) {
    const chosen = results[index];
    if (!chosen) return;
    setQuery('');
    setDismissed(false);
    navigate(chosen.page.path);
  }

  function onKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      setDismissed(true);
      return;
    }
    if (!open || results.length === 0) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((current) => (current + 1) % results.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((current) => (current - 1 + results.length) % results.length);
    } else if (event.key === 'Home') {
      event.preventDefault();
      setActiveIndex(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      setActiveIndex(results.length - 1);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      goTo(activeIndex);
    }
  }

  const activeId = open && results[activeIndex] ? `${listboxId}-${activeIndex}` : undefined;

  return (
    <div ref={containerRef} className={`relative ${className ?? ''}`}>
      <div className="relative">
        <Search
          width={16}
          height={16}
          aria-hidden
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted"
        />
        <input
          type="search"
          role="combobox"
          aria-label={label}
          aria-expanded={open}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={activeId}
          placeholder={label}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setDismissed(false);
          }}
          onKeyDown={onKeyDown}
          className="w-full rounded-lg border border-border bg-surface py-2 pl-9 pr-3 text-sm text-ink placeholder:text-ink-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        />
      </div>

      {open ? (
        <ul
          id={listboxId}
          role="listbox"
          aria-label="Search results"
          className="absolute left-0 right-0 top-full z-30 mt-2 max-h-96 overflow-y-auto rounded-lg border border-border bg-surface p-1 shadow-lg"
        >
          {results.length === 0 ? (
            <li className="px-3 py-3 text-sm text-ink-muted">No page mentions that yet.</li>
          ) : (
            results.map((result, index) => (
              <li
                key={result.page.contentKey}
                id={`${listboxId}-${index}`}
                role="option"
                aria-selected={index === activeIndex}
              >
                <button
                  type="button"
                  tabIndex={-1}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => goTo(index)}
                  className={`block w-full rounded-md px-3 py-2 text-left transition-colors duration-fast ease-standard ${
                    index === activeIndex ? 'bg-subtle' : ''
                  }`}
                >
                  <span className="flex items-baseline gap-2">
                    <span className="text-sm font-medium text-ink">{result.page.title}</span>
                    <span className="text-xs text-ink-muted">{result.sectionTitle}</span>
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-ink-muted">
                    {result.heading ? `${result.heading} · ` : ''}
                    {result.snippet}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
