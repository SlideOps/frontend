import { useId, useState, type ReactNode } from 'react';
import { cn } from '../lib/cn';
import { Text } from './Text';

/*
 * A section of a page.
 *
 * Card was doing this job and doing it badly. Card draws a border, a shadow and
 * twenty four pixels of padding, which is right for something that is genuinely a
 * card: a tile in a grid, a dialog, something that could be picked up and moved.
 * A page's own sections are not that. They are one document, and giving each part
 * of a document its own border says they are separate things when they are not.
 *
 * The cost was real. Five sections became five boxes, each with its own frame and
 * padding, so a page grew a scrollbar before it had said very much, and the
 * borders carried no information: every section looked equally important because
 * every section looked identical.
 *
 * This separates with space and a hairline instead. Nothing is lost, because the
 * heading already tells you a new section began, and reading down the page is
 * quieter.
 */

export interface SectionProps {
  /** The heading. A section without one is a paragraph, not a section. */
  title: ReactNode;
  /** One line on what this part is for, when the heading is not enough alone. */
  description?: ReactNode;
  /** Sits beside the heading: the control this section is about. */
  action?: ReactNode;
  /** Sits with the heading, for a guidance tooltip or a badge. */
  adornment?: ReactNode;
  /** Drop the separator, for the first section on a page. */
  flush?: boolean;
  /**
   * Let the Operator fold this section away.
   *
   * A long page of equally expanded sections is its own kind of unreadable: the
   * one thing being worked on is somewhere in the middle of everything that is
   * not. Folding is per section and per visit rather than remembered, because a
   * remembered collapse hides something the next time it matters and gives no
   * clue why the page looks different.
   */
  collapsible?: boolean;
  /** Whether a collapsible section starts open. Ignored when not collapsible. */
  defaultOpen?: boolean;
  /** Sits with the heading when collapsed, to say what is inside without opening it. */
  summary?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function Section({
  title,
  description,
  action,
  adornment,
  flush = false,
  collapsible = false,
  defaultOpen = true,
  summary,
  children,
  className,
}: SectionProps) {
  // A section is only exposed as a landmark once it has an accessible name, so
  // the heading is wired to it. Without this it is a plain div to a screen
  // reader, and the page has no structure to navigate by at all: the visual
  // separation would be there and the actual one would not.
  const headingId = useId();
  const bodyId = useId();
  const [open, setOpen] = useState(defaultOpen);
  const expanded = !collapsible || open;

  const heading = (
    <div className="flex flex-wrap items-center gap-2">
      <Text variant="h4" id={headingId}>
        {title}
      </Text>
      {adornment}
      {collapsible && !expanded && summary ? (
        <Text variant="body-sm" tone="secondary">
          {summary}
        </Text>
      ) : null}
    </div>
  );

  return (
    <section
      aria-labelledby={headingId}
      className={cn(
        'flex flex-col gap-4',
        // The hairline and the space above it are the whole separation. A border
        // on four sides would be a box again.
        flush ? '' : 'border-t border-border pt-8',
        className,
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          {collapsible ? (
            // The heading itself is the control. A separate chevron beside a
            // heading that does nothing is a smaller target and a worse guess:
            // people click the words.
            <button
              type="button"
              onClick={() => setOpen((current) => !current)}
              aria-expanded={expanded}
              aria-controls={bodyId}
              className="group -mx-1 flex items-center gap-1.5 rounded-md px-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            >
              <svg
                width={14}
                height={14}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
                className={cn(
                  'shrink-0 text-ink-muted transition-transform duration-fast ease-standard group-hover:text-ink',
                  expanded ? 'rotate-90' : '',
                )}
              >
                <path d="m9 18 6-6-6-6" />
              </svg>
              {heading}
            </button>
          ) : (
            heading
          )}
          {description && expanded ? (
            <Text variant="body-sm" tone="secondary" className="mt-1 block max-w-3xl">
              {description}
            </Text>
          ) : null}
        </div>
        {/* A collapsed section's action is hidden with it. Leaving a Refresh
            button beside a folded heading invites refreshing something nobody
            can see. */}
        {action && expanded ? <div className="shrink-0">{action}</div> : null}
      </div>
      {/* Unmounted rather than hidden. These bodies hold live things, a polling
          metrics panel and an open shell among them, and a display:none terminal
          is still connected and still costing something. */}
      {expanded ? (
        // Carries the column layout the children used to get from the section
        // itself, so wrapping them here does not close the gaps between them.
        <div id={bodyId} className="flex min-w-0 flex-col gap-4">
          {children}
        </div>
      ) : null}
    </section>
  );
}
