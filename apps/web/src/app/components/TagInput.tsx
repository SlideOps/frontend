import { cn } from '@slideops/design-system';
import { X } from '@slideops/icons';
import { useState } from 'react';

/**
 * A chip editor for a Node's tags. Typing a tag and pressing Enter or a comma
 * commits it as a chip; clicking a chip's X removes it. Controlled, so the
 * caller owns the actual list and can wire it into a form field or a direct
 * save call.
 */
export function TagInput({
  value,
  onChange,
  placeholder = 'production, eu-west',
}: {
  value: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState('');

  const commit = (raw: string) => {
    const tag = raw.trim();
    if (tag === '' || value.includes(tag)) {
      setDraft('');
      return;
    }
    onChange([...value, tag]);
    setDraft('');
  };

  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-1.5 rounded-md border border-border bg-surface px-2 py-1.5',
        'focus-within:ring-2 focus-within:ring-focus',
      )}
    >
      {value.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center gap-1 rounded-pill bg-subtle px-2 py-0.5 text-xs font-medium text-ink-muted"
        >
          {tag}
          <button
            type="button"
            onClick={() => onChange(value.filter((t) => t !== tag))}
            className="rounded-full text-ink-muted transition-colors duration-fast ease-standard hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            aria-label={`Remove tag ${tag}`}
          >
            <X width={11} height={11} aria-hidden />
          </button>
        </span>
      ))}
      <input
        type="text"
        value={draft}
        placeholder={value.length === 0 ? placeholder : undefined}
        className="h-7 min-w-24 flex-1 border-0 bg-transparent px-1 text-sm text-ink placeholder:text-ink-muted focus:outline-none"
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ',') {
            event.preventDefault();
            commit(draft);
          } else if (event.key === 'Backspace' && draft === '' && value.length > 0) {
            onChange(value.slice(0, -1));
          }
        }}
        onBlur={() => commit(draft)}
      />
    </div>
  );
}
