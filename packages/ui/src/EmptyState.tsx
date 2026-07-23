import { Text } from '@slideops/design-system';
import type { LucideIcon } from '@slideops/icons';
import type { ReactNode } from 'react';

export interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  /** A primary action, such as connecting the first Node. */
  action?: ReactNode;
}

/** A calm, guiding empty state. Part of how the product teaches as work begins. */
export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-surface px-6 py-16 text-center">
      <span className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-pill bg-subtle text-brand">
        <Icon width={26} height={26} aria-hidden />
      </span>
      <Text variant="h3">{title}</Text>
      <Text variant="body" tone="secondary" className="mt-2 max-w-md">
        {description}
      </Text>
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}
