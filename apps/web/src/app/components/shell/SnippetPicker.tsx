import { ApiError, listSnippets, type Snippet } from '@slideops/api-client';
import { Button, Text } from '@slideops/design-system';
import { ListChecks } from '@slideops/icons';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

/*
 * Picks a saved command into the active terminal tab.
 *
 * It types the command -- the same path a keystroke takes -- and stops there.
 * It does not press Enter for the Operator: a snippet is a shortcut for typing,
 * not a way to run a command nobody watched arrive, which is exactly the
 * "nothing runs unseen" posture the shell itself already holds to.
 */

export function SnippetPicker({ onPick, disabled }: { onPick: (command: string) => void; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const [snippets, setSnippets] = useState<Snippet[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || snippets !== null) {
      return;
    }
    let cancelled = false;
    listSnippets()
      .then((list) => {
        if (!cancelled) {
          setSnippets(list);
        }
      })
      .catch((caught) => {
        if (!cancelled) {
          setError(caught instanceof ApiError ? caught.message : 'Your snippets could not be loaded.');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [open, snippets]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onPointerDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <Button
        size="sm"
        variant="ghost"
        onClick={() => setOpen((was) => !was)}
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="true"
      >
        <ListChecks width={15} height={15} aria-hidden />
        Snippets
      </Button>

      {open ? (
        <div className="absolute right-0 top-full z-10 mt-1 w-72 rounded-md border border-border bg-surface p-2 shadow-lg">
          {error ? <p className="px-2 py-1 text-sm text-danger">{error}</p> : null}
          {!error && snippets === null ? (
            <p className="px-2 py-1 text-sm text-ink-muted">Loading…</p>
          ) : null}
          {!error && snippets && snippets.length === 0 ? (
            <p className="px-2 py-1 text-sm text-ink-muted">No snippets saved yet.</p>
          ) : null}
          {snippets && snippets.length > 0 ? (
            <ul className="flex max-h-64 flex-col gap-0.5 overflow-y-auto">
              {snippets.map((snippet) => (
                <li key={snippet.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onPick(snippet.command);
                      setOpen(false);
                    }}
                    className="w-full rounded-md px-2 py-1.5 text-left transition-colors duration-fast ease-standard hover:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                  >
                    <Text variant="body-sm" className="font-medium">
                      {snippet.name}
                    </Text>
                    <Text variant="caption" tone="secondary" className="block truncate font-mono">
                      {snippet.command}
                    </Text>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          <div className="mt-1 border-t border-border pt-1">
            <Link
              to="/app/snippets"
              className="block rounded-md px-2 py-1.5 text-sm text-ink-muted transition-colors duration-fast ease-standard hover:bg-subtle hover:text-ink"
            >
              Manage snippets
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
