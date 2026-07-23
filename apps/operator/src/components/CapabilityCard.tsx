import type { Capability } from '@slideops/api-client';
import { Card, Text } from '@slideops/design-system';
import { Layers } from '@slideops/icons';
import { Guidance } from '@slideops/tooltips';
import type { ReactNode } from 'react';
import { RiskBadge } from './Badges';

/*
 * One Capability presented for what it achieves: its outcome name, its category,
 * a plain description, and its risk. The action that starts an Operation is
 * passed in as a footer, so the same card serves the catalog and the Node view.
 */
export function CapabilityCard({
  capability,
  footer,
}: {
  capability: Capability;
  footer?: ReactNode;
}) {
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-subtle text-brand">
          <Layers width={18} height={18} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Text variant="h4">{capability.name}</Text>
          </div>
          <div className="mt-0.5 flex items-center gap-1">
            <Text variant="caption" tone="secondary">
              {capability.category}
            </Text>
            <Guidance for="capability.category" size={14} />
          </div>
        </div>
        <div className="flex items-center gap-1">
          <RiskBadge risk={capability.risk_level} />
          <Guidance for="capability.risk" size={14} />
        </div>
      </div>
      <Text variant="body-sm" tone="secondary">
        {capability.description}
      </Text>
      {footer ? <div className="mt-1">{footer}</div> : null}
    </Card>
  );
}
