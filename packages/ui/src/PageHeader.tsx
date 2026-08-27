import { cn, Text } from '@slideops/design-system';
import { Guidance } from '@slideops/tooltips';
import type { ReactNode } from 'react';

export interface PageHeaderProps {
  title: string;
  description?: string;
  /** Optional guidance key that attaches plain-language help to the heading. */
  guidanceKey?: string;
  /** Actions aligned to the end of the header row. */
  actions?: ReactNode;
  /**
   * A TabNav for a single resource's own page. Rendered below the title, with
   * the header's own hairline moving down to sit under the tabs instead of
   * under the title, so the strip reads as switching within this one page
   * rather than as a second, competing header.
   */
  tabs?: ReactNode;
}

/** A consistent page heading with an optional guidance trigger and actions. */
export function PageHeader({ title, description, guidanceKey, actions, tabs }: PageHeaderProps) {
  return (
    <div className={cn('mb-8', tabs ? '' : 'border-b border-border pb-6')}>
      <div className="flex flex-wrap items-end justify-between gap-5 pb-6">
        <div className="min-w-0">
          <div className="mb-1 text-xs font-medium uppercase tracking-wide text-ink-muted">
            SlideOps
          </div>
          <div className="flex items-center gap-2">
            <Text variant="h1">{title}</Text>
            {guidanceKey ? <Guidance for={guidanceKey} placement="bottom" /> : null}
          </div>
          {description ? (
            <Text variant="body" tone="secondary" className="mt-2 max-w-2xl">
              {description}
            </Text>
          ) : null}
        </div>
        {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
      </div>
      {tabs}
    </div>
  );
}
