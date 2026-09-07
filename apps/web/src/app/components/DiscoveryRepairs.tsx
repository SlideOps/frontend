import { type DiscoveryRepair } from '@slideops/api-client';
import { Text } from '@slideops/design-system';
import { Wrench } from '@slideops/icons';

/**
 * What the rediscovery found broken on this Node and is putting right.
 *
 * Discovery only ever observed, which left an Operator reading the same
 * "reachable at its port only" report on every run while they went to a
 * terminal to fix the routing by hand. Now the looking is followed by fixing,
 * and this is where that is said out loud -- SlideOps acting on its own has to
 * be visible, never silent.
 */
export function DiscoveryRepairs({ repairs }: { repairs: DiscoveryRepair[] }) {
  const started = repairs.filter((r) => r.repairing);
  if (started.length === 0) return null;

  return (
    <div className="flex flex-col gap-2 rounded-md border border-border bg-surface-muted p-4">
      <div className="flex items-center gap-2">
        <Wrench width={14} height={14} className="text-ink-muted" aria-hidden />
        <Text variant="body-sm" className="font-medium text-ink">
          Putting {started.length === 1 ? 'one thing' : `${started.length} things`} right
        </Text>
      </div>
      <ul className="flex flex-col gap-1">
        {started.map((repair) => (
          <li key={repair.service_id}>
            <Text variant="body-sm" tone="secondary">
              <span className="text-ink">{repair.service_name}</span>: {repair.problem}.
              Setting it up again now.
            </Text>
          </li>
        ))}
      </ul>
      <Text variant="caption" tone="secondary">
        Each runs as an ordinary Operation you can follow in History. Addresses become
        reachable a moment after this finishes, not the instant it does.
      </Text>
    </div>
  );
}
