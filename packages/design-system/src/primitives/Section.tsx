import { useId, type ReactNode } from 'react';
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
  children: ReactNode;
  className?: string;
}

export function Section({
  title,
  description,
  action,
  adornment,
  flush = false,
  children,
  className,
}: SectionProps) {
  // A section is only exposed as a landmark once it has an accessible name, so
  // the heading is wired to it. Without this it is a plain div to a screen
  // reader, and the page has no structure to navigate by at all: the visual
  // separation would be there and the actual one would not.
  const headingId = useId();

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
          <div className="flex flex-wrap items-center gap-2">
            <Text variant="h4" id={headingId}>
              {title}
            </Text>
            {adornment}
          </div>
          {description ? (
            <Text variant="body-sm" tone="secondary" className="mt-1 block max-w-3xl">
              {description}
            </Text>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}
