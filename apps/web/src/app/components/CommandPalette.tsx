import { search } from '@slideops/api-client';
import { Text } from '@slideops/design-system';
import { Search } from '@slideops/icons';
import { useCallback, useEffect, useReducer, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  emptyResults,
  initialPaletteState,
  paletteReducer,
  type PaletteItem,
} from './command-palette';

/*
 * The command palette. It opens with Control or Command plus K and from the
 * visible search affordance in the shell, queries the workspace-wide search as
 * the Operator types (debounced), and shows results grouped by kind. It is fully
 * keyboard driven: the arrow keys move a single active item across every group,
 * Enter opens it, and Escape closes. It carries listbox and option semantics and
 * an active-descendant so assistive technology follows the selection, and it
 * restores focus to wherever the Operator was when it closes.
 */

const LISTBOX_ID = 'command-palette-listbox';
const optionId = (index: number) => `command-palette-option-${index}`;

export interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const navigate = useNavigate();
  const [state, dispatch] = useReducer(paletteReducer, initialPaletteState);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  const close = useCallback(() => {
    onOpenChange(false);
    dispatch({ type: 'reset' });
  }, [onOpenChange]);

  const open_ = useCallback(() => onOpenChange(true), [onOpenChange]);

  // The global shortcut. Control or Command plus K opens the palette from
  // anywhere in the app, and repeating it is a no-op while it is already open.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        open_();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open_]);

  // Move focus into the input on open, and restore it to the trigger on close.
  useEffect(() => {
    if (!open) {
      return;
    }
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    inputRef.current?.focus();
    return () => {
      previouslyFocused.current?.focus?.();
    };
  }, [open]);

  // Debounce the query and run the search, cancelling any request in flight when
  // the query changes again or the palette closes. A blank query clears results.
  useEffect(() => {
    if (!open) {
      return;
    }
    const query = state.query.trim();
    if (query === '') {
      dispatch({ type: 'results', results: emptyResults });
      return;
    }
    const controller = new AbortController();
    dispatch({ type: 'loading' });
    const handle = window.setTimeout(() => {
      search(query, controller.signal)
        .then((results) => dispatch({ type: 'results', results }))
        .catch(() => {
          if (controller.signal.aborted) {
            return;
          }
          dispatch({ type: 'error' });
        });
    }, 180);
    return () => {
      window.clearTimeout(handle);
      controller.abort();
    };
  }, [open, state.query]);

  // Keep the active option scrolled into view as the arrow keys move through it.
  useEffect(() => {
    if (!open) {
      return;
    }
    const active = listRef.current?.querySelector<HTMLElement>(`#${optionId(state.activeIndex)}`);
    active?.scrollIntoView({ block: 'nearest' });
  }, [open, state.activeIndex]);

  const openItem = useCallback(
    (item: PaletteItem | undefined) => {
      if (!item) {
        return;
      }
      close();
      navigate(item.to);
    },
    [close, navigate],
  );

  if (!open) {
    return null;
  }

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      dispatch({ type: 'move', delta: 1 });
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      dispatch({ type: 'move', delta: -1 });
    } else if (event.key === 'Enter') {
      event.preventDefault();
      openItem(state.items[state.activeIndex]);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      close();
    }
  };

  const hasQuery = state.query.trim() !== '';
  const activeItem = state.items[state.activeIndex];

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-overlay p-4 pt-[12vh]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          close();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search the workspace"
        className="w-full max-w-xl overflow-hidden rounded-lg border border-border bg-surface shadow-lg transition duration-base ease-entrance"
      >
        <div className="flex items-center gap-3 border-b border-border px-4">
          <Search width={18} height={18} className="shrink-0 text-ink-muted" aria-hidden />
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded
            aria-controls={LISTBOX_ID}
            aria-activedescendant={activeItem ? optionId(state.activeIndex) : undefined}
            aria-label="Search Nodes, Projects, Capabilities, and Operations"
            placeholder="Search Nodes, Projects, Capabilities, Operations"
            value={state.query}
            onChange={(event) => dispatch({ type: 'query', query: event.target.value })}
            onKeyDown={onKeyDown}
            autoComplete="off"
            spellCheck={false}
            className="h-14 w-full bg-transparent text-base text-ink placeholder:text-ink-muted focus-visible:outline-none"
          />
          <kbd className="hidden rounded border border-border px-1.5 py-0.5 text-xs text-ink-muted sm:inline">
            Esc
          </kbd>
        </div>

        <ul
          ref={listRef}
          id={LISTBOX_ID}
          role="listbox"
          aria-label="Search results"
          className="max-h-[52vh] overflow-y-auto py-2"
        >
          {state.status === 'error' ? (
            <li className="px-4 py-6 text-center" role="alert">
              <Text variant="body-sm" tone="secondary">
                Search did not run. Try again.
              </Text>
            </li>
          ) : !hasQuery ? (
            <li className="px-4 py-6 text-center">
              <Text variant="body-sm" tone="secondary">
                Start typing to search across your Nodes, Projects, Capabilities, and Operations.
              </Text>
            </li>
          ) : state.status === 'loading' ? (
            <li className="px-4 py-6 text-center" role="status">
              <Text variant="body-sm" tone="secondary">
                Searching
              </Text>
            </li>
          ) : state.items.length === 0 ? (
            <li className="px-4 py-6 text-center">
              <Text variant="body-sm" tone="secondary">
                Nothing matches that yet.
              </Text>
            </li>
          ) : (
            state.groups.map((group) => (
              <li key={group.kind}>
                <div className="px-4 pb-1 pt-2 text-xs font-medium uppercase tracking-wide text-ink-muted">
                  {group.heading}
                </div>
                <ul role="presentation">
                  {group.items.map((item) => {
                    const index = state.items.indexOf(item);
                    const active = index === state.activeIndex;
                    return (
                      <li
                        key={item.key}
                        id={optionId(index)}
                        role="option"
                        aria-selected={active}
                        onMouseMove={() =>
                          active
                            ? undefined
                            : dispatch({ type: 'move', delta: index - state.activeIndex })
                        }
                        onClick={() => openItem(item)}
                        className={`mx-2 flex cursor-pointer items-center justify-between gap-3 rounded-md px-2 py-2 ${
                          active ? 'bg-subtle' : ''
                        }`}
                      >
                        <span className="min-w-0">
                          <Text variant="body-sm" className="truncate font-medium">
                            {item.label}
                          </Text>
                          {item.hint ? (
                            <Text variant="body-sm" tone="secondary" className="truncate">
                              {item.hint}
                            </Text>
                          ) : null}
                        </span>
                        <span className="shrink-0 text-xs text-ink-muted">{group.heading}</span>
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
