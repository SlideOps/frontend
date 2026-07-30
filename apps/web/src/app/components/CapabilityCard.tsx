import type { Capability } from '@slideops/api-client';
import { Text } from '@slideops/design-system';
import { Layers } from '@slideops/icons';
import type { ReactNode } from 'react';
import { PluginSourceBadge, RiskBadge } from './Badges';

/*
 * One Capability, as a row rather than a box.
 *
 * It was a bordered card with a coloured tile, a heading, a category, two badges
 * and a paragraph. Thirty of those made the catalogue an endless column of
 * near identical rectangles: the borders carried no information, they only made
 * everything four times taller, and finding one Capability meant reading all of
 * them.
 *
 * So the border is gone and the separation comes from spacing and a hairline.
 * Everything still here answers a question: what it does, where it came from,
 * whether it is already in place, and what running it would cost. The description
 * is clamped to two lines, because the detail page exists and a list is for
 * finding rather than for reading.
 *
 * Risk is told the state, so something already in place stops shouting a warning
 * about an action that has already been taken.
 */
export function CapabilityCard({
  capability,
  footer,
  badge,
  inPlace = false,
}: {
  capability: Capability;
  footer?: ReactNode;
  badge?: ReactNode;
  /** True when this Capability's outcome is already in place where it is shown. */
  inPlace?: boolean;
}) {
  return (
    <div className="flex items-start gap-3 border-b border-border px-1 py-3.5 last:border-b-0">
      <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-subtle text-brand">
        <Layers width={15} height={15} aria-hidden />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <Text variant="body-sm" className="font-medium">
            {capability.name}
          </Text>
          <Text variant="caption" tone="secondary">
            {capability.category}
          </Text>
          <PluginSourceBadge capability={capability} />
          {badge}
        </div>

        {/* Two lines is enough to tell one Capability from another. Anyone who
            wants the whole description is opening the detail page anyway. */}
        <Text variant="caption" tone="secondary" className="mt-1 line-clamp-2 block">
          {capability.description}
        </Text>

        {footer ? <div className="mt-2">{footer}</div> : null}
      </div>

      <div className="shrink-0 pt-0.5">
        <RiskBadge risk={capability.risk_level} inPlace={inPlace} />
      </div>
    </div>
  );
}
