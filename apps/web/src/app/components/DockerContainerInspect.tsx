import type { DockerInspect } from '@slideops/api-client';
import { Card, Text } from '@slideops/design-system';
import { HeartPulse } from '@slideops/icons';
import { healthSummary, inspectSections } from '../docker-inspect';
import { Collapsible } from './Collapsible';
import { CopyButton } from './CopyButton';

/*
 * Everything the daemon knows about one container, as it is read rather than as
 * Docker nests it.
 *
 * The grouping, the labels and the decisions about what is worth a row all live
 * in docker-inspect.ts, where they can be asserted. This file draws them. A
 * section that came back with no rows was already dropped there, so an empty
 * "Resources" heading never appears to say "this container has no resources"
 * when the truth is that nobody set any limits.
 *
 * The raw JSON is behind a disclosure rather than on the page. It is the thing
 * an Operator wants when they are past the readable version and into comparing
 * two containers field by field, and it is also a wall of text that would bury
 * the readable version if it were simply printed underneath. What is in it is
 * exactly what the backend sent: no environment, because the contract carries
 * none, so nothing here can leak a password that never reached the browser.
 */

export interface DockerContainerInspectProps {
  inspect: DockerInspect;
  containerName: string;
}

/** The Inspect tab: labelled sections, then the raw record for anyone who wants it. */
export function DockerContainerInspect({ inspect, containerName }: DockerContainerInspectProps) {
  const sections = inspectSections(inspect);
  const health = healthSummary(inspect);
  const raw = JSON.stringify(inspect, null, 2);

  return (
    <div className="flex flex-col gap-6">
      {health ? (
        <div className="flex items-start gap-3 rounded-md border border-border bg-subtle px-4 py-3">
          <HeartPulse width={18} height={18} className="mt-0.5 shrink-0 text-brand" aria-hidden />
          <Text variant="body-sm" tone="secondary">
            {health}
          </Text>
        </div>
      ) : null}

      {sections.map((section) => (
        <Card key={section.key} className="flex flex-col gap-3">
          <Text variant="h4">{section.title}</Text>
          <dl className="divide-y divide-border">
            {section.rows.map((row) => (
              <div
                key={row.label}
                className="grid gap-1 py-2 sm:grid-cols-[12rem_1fr] sm:gap-3 first:pt-0 last:pb-0"
              >
                <dt className="text-xs font-medium text-ink-muted">{row.label}</dt>
                <dd className="min-w-0 break-words font-mono text-sm text-ink">{row.value}</dd>
              </div>
            ))}
          </dl>
        </Card>
      ))}

      <Collapsible
        title="View raw JSON"
        summary={`Everything SlideOps was told about ${containerName}`}
      >
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <Text variant="body-sm" tone="secondary">
              The record exactly as the backend sent it. It carries no environment variables: those
              are never brought to the browser, so this cannot show a password even by accident.
            </Text>
            <CopyButton value={raw} label={`the raw record for ${containerName}`} />
          </div>
          <pre className="max-h-[32rem] overflow-auto rounded-md border border-border bg-subtle p-3 font-mono text-xs leading-relaxed text-ink">
            {raw}
          </pre>
        </div>
      </Collapsible>
    </div>
  );
}
