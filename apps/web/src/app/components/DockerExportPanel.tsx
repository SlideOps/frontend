import type { DockerInspect } from '@slideops/api-client';
import { Button, Card, Text, cn } from '@slideops/design-system';
import { AlertTriangle, FileText, Terminal } from '@slideops/icons';
import { useState } from 'react';
import {
  REDACTION_NOTICE,
  composeServiceSnippet,
  exportSourceFromInspect,
  runCommand,
} from '../docker-compose-view';
import { CopyButton } from './CopyButton';

/*
 * Taking a container's configuration somewhere else.
 *
 * Two forms, because the two answer different questions: a docker run command
 * reproduces it on a server with a shell, and a Compose service reproduces it
 * in a file somebody keeps. Both are built from the inspect the detail page
 * already read, so nothing extra is asked of the Node.
 *
 * Secrets are the reason this panel is careful. SlideOps deliberately does not
 * carry a running container's environment to the browser, so an export built
 * from an inspect has no values in it to begin with, and the keys that do
 * appear carry a placeholder. The opt-in below exists for the case where an
 * Operator supplied the values themselves and wants them back; it cannot
 * reveal anything the page was never given.
 */

type ExportShape = 'run' | 'compose';

export function DockerExportPanel({ inspect }: { inspect: DockerInspect }) {
  const [shape, setShape] = useState<ExportShape>('run');
  const [includeSecrets, setIncludeSecrets] = useState(false);

  const source = exportSourceFromInspect(inspect);
  const text =
    shape === 'run'
      ? runCommand(source, { includeSecrets })
      : composeServiceSnippet(source, { includeSecrets });

  // The page holds no environment values for a running container, so there is
  // nothing for the opt-in to reveal. Saying that is more useful than offering
  // a switch that changes nothing.
  const hasEnvValues = Object.values(source.env).some((value) => value !== '');

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Text variant="body-sm" className="font-medium">
            Export this configuration
          </Text>
          <Text variant="caption" tone="secondary" className="block">
            Configuration only. Nothing here carries the container's data or its running state.
          </Text>
        </div>
        <div className="flex items-center gap-2">
          {(
            [
              { key: 'run', label: 'docker run', icon: Terminal },
              { key: 'compose', label: 'Compose', icon: FileText },
            ] as const
          ).map((option) => (
            <Button
              key={option.key}
              size="sm"
              variant={shape === option.key ? 'secondary' : 'ghost'}
              onClick={() => setShape(option.key)}
            >
              <option.icon width={15} height={15} aria-hidden />
              {option.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="relative">
        <pre
          className={cn(
            'max-h-80 overflow-auto rounded-md border border-border bg-subtle p-4',
            'font-mono text-xs leading-relaxed text-ink',
          )}
        >
          {text}
        </pre>
        <div className="absolute right-2 top-2">
          <CopyButton value={text} label="Copy" />
        </div>
      </div>

      {hasEnvValues ? (
        <label className="flex items-start gap-2">
          <input
            type="checkbox"
            checked={includeSecrets}
            onChange={(event) => setIncludeSecrets(event.target.checked)}
            className="mt-1 h-4 w-4 rounded border-border text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          />
          <span>
            <Text as="span" variant="body-sm">
              Include environment values
            </Text>
            <Text variant="caption" tone="secondary" className="block">
              Off by default. An export with real values in it is a secret, and whatever you paste
              it into is now holding one.
            </Text>
          </span>
        </label>
      ) : (
        <div className="flex items-start gap-2 rounded-md border border-border bg-subtle px-3 py-2">
          <AlertTriangle
            width={15}
            height={15}
            className="mt-0.5 shrink-0 text-warning"
            aria-hidden
          />
          <Text variant="caption" tone="secondary">
            {REDACTION_NOTICE.replace(/^#\s*/, '')} SlideOps never reads a running container's
            environment, so the values are not available here to export even if you wanted them.
          </Text>
        </div>
      )}
    </Card>
  );
}
