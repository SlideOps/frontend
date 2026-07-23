import { Text } from '@slideops/design-system';
import { Guidance } from '@slideops/tooltips';
import type { ReactNode } from 'react';

export interface PageHeaderProps {
  title: string;
  description?: string;
  /** Optional guidance key that attaches plain-language help to the heading. */
  guidanceKey?: string;
  /** Actions aligned to the end of the header row. */
  actions?: ReactNode;
}

/** A consistent page heading with an optional guidance trigger and actions. */
export function PageHeader({ title, description, guidanceKey, actions }: PageHeaderProps) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
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
  );
}
