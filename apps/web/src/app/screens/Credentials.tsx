import {
  listNodes,
  listOperations,
  listProjects,
  revealOperationSecret,
  type Node,
  type Operation,
  type Project,
} from '@slideops/api-client';
import { Button, Text } from '@slideops/design-system';
import { KeyRound } from '@slideops/icons';
import { EmptyState, PageHeader } from '@slideops/ui';
import { useMemo, useState } from 'react';
import { CredentialsCard } from '../components/CredentialsCard';
import { ErrorNote, Loading } from '../components/Feedback';
import { OperatorShell } from '../components/OperatorShell';
import { useAsyncData } from '../hooks/useAsyncData';

/**
 * The literal a secret parameter carries in an Operation's `parameters`. A
 * parameter is a stored secret, and revealable, exactly when its value is this
 * string; the plaintext lives only behind the reveal endpoint, never in the
 * record. This is the same contract the CredentialsCard reads.
 */
const SECRET_PLACEHOLDER = '[stored securely]';

/** The connection details worth writing into a downloaded file, in scan order. */
const CONNECTION_KEYS = [
  'database',
  'username',
  'user',
  'host',
  'hostname',
  'address',
  'port',
] as const;

/** The filename base for the combined download. */
const ALL_FILE_NAME = 'slideops-credentials.env';

/** A Capability produced credentials exactly when it stored at least one secret. */
function hasStoredSecret(operation: Operation): boolean {
  const parameters = operation.parameters ?? {};
  return Object.values(parameters).some((value) => value === SECRET_PLACEHOLDER);
}

/** A readable Capability name from its key, in Operator language. */
function capabilityName(key: string): string {
  return key
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\w/, (c) => c.toUpperCase());
}

/** An environment-variable-safe key, upper snake case, for a downloaded file. */
function envKey(key: string): string {
  return key
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toUpperCase();
}

/** Quote a value so newlines and quotes in it never break the .env line. */
function envQuote(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`;
}

/** A short, stable slug of an Operation id for a per-item filename. */
function shortId(id: string): string {
  return id.replace(/[^A-Za-z0-9]+/g, '').slice(0, 8) || 'credential';
}

interface CredentialContext {
  operation: Operation;
  title: string;
  nodeName: string | null;
  projectName: string | null;
  completedAt: string | null;
}

/**
 * Build the .env-style text for one credential, revealing each stored secret on
 * demand. Secrets are fetched here, held only in the string that becomes the
 * download, and never logged or placed in any URL.
 */
async function buildCredentialBlock(
  context: CredentialContext,
  signal?: AbortSignal,
): Promise<string> {
  const { operation } = context;
  const parameters = operation.parameters ?? {};

  const lines: string[] = [];
  const heading = [context.nodeName, context.projectName].filter(Boolean).join(' / ');
  lines.push(`# ${context.title}${heading ? ` (${heading})` : ''}`);
  if (context.completedAt) {
    lines.push(`# Completed ${context.completedAt}`);
  }

  for (const key of CONNECTION_KEYS) {
    const value = parameters[key];
    if (value === SECRET_PLACEHOLDER) {
      continue;
    }
    if ((typeof value === 'string' || typeof value === 'number') && String(value).length > 0) {
      lines.push(`${envKey(key)}=${envQuote(String(value))}`);
    }
  }

  const secretKeys = Object.keys(parameters).filter(
    (key) => parameters[key] === SECRET_PLACEHOLDER,
  );
  for (const key of secretKeys) {
    const revealed = await revealOperationSecret(operation.id, key, signal);
    lines.push(`${envKey(key)}=${envQuote(revealed.value)}`);
  }

  return lines.join('\n');
}

/** Trigger a client-side download of text without stealing focus from the page. */
function downloadText(fileName: string, text: string): void {
  const blob = new Blob([`${text}\n`], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

/** A labelled wrapper naming what a credential is for, above its reveal card. */
function CredentialSection({
  context,
  onDownload,
  downloading,
}: {
  context: CredentialContext;
  onDownload: () => void;
  downloading: boolean;
}) {
  const meta = [context.nodeName, context.projectName].filter(Boolean).join(' / ');
  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border bg-raised p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Text variant="h4">{context.title}</Text>
          <Text variant="body-sm" tone="secondary" className="mt-0.5">
            {meta ? `${meta}` : 'No Node recorded'}
            {context.completedAt ? ` · ${context.completedAt}` : ''}
          </Text>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={onDownload}
          disabled={downloading}
          aria-busy={downloading || undefined}
        >
          {downloading ? 'Preparing' : 'Download'}
        </Button>
      </div>
      <CredentialsCard operation={context.operation} />
    </section>
  );
}

const selectClass =
  'h-10 rounded-md border border-border bg-surface px-3 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus';

/**
 * Credentials: every secret SlideOps created for the Operator while running a
 * Capability, gathered from their Operations so each can be revealed, copied,
 * and downloaded for use in other tools. It shows what SlideOps generated
 * (database passwords, service secrets, connection details), not SSH private
 * keys, which SlideOps never holds because create-app-user takes a public key
 * the Operator provides.
 */
export function Credentials() {
  const { state } = useAsyncData(
    (signal) =>
      Promise.all([
        listOperations({}, signal),
        listNodes(signal),
        listProjects(signal),
      ]).then(([operations, nodes, projects]) => ({ operations, nodes, projects })),
    [],
  );

  const [projectFilter, setProjectFilter] = useState<string>('all');
  // Which credential is being prepared for download; 'all' covers the whole set.
  const [downloading, setDownloading] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<Error | null>(null);

  const data =
    state.status === 'ready'
      ? state.data
      : { operations: [] as Operation[], nodes: [] as Node[], projects: [] as Project[] };

  const contexts = useMemo<CredentialContext[]>(() => {
    const nodeById = new Map(data.nodes.map((node) => [node.id, node] as const));
    const projectById = new Map(data.projects.map((project) => [project.id, project] as const));

    return data.operations
      // Only a completed Operation actually created its credential; a failed
      // attempt left a sealed value but no usable result, so it must not appear
      // (which is what showed a failed run as a duplicate of the real one).
      .filter((operation) => operation.status === 'completed')
      .filter(hasStoredSecret)
      .map((operation) => {
        const node = nodeById.get(operation.node_id) ?? null;
        const project = node?.project_id ? projectById.get(node.project_id) ?? null : null;
        return {
          operation,
          title: capabilityName(operation.capability_key),
          nodeName: node?.name ?? null,
          projectName: project?.name ?? null,
          completedAt: operation.completed_at
            ? new Date(operation.completed_at).toLocaleString()
            : null,
        };
      })
      .sort((a, b) => {
        const at = a.operation.completed_at ?? a.operation.created_at ?? '';
        const bt = b.operation.completed_at ?? b.operation.created_at ?? '';
        return bt.localeCompare(at);
      });
  }, [data]);

  const visible = useMemo(() => {
    if (projectFilter === 'all') {
      return contexts;
    }
    if (projectFilter === 'none') {
      return contexts.filter((context) => context.projectName === null);
    }
    return contexts.filter((context) => context.projectName === projectFilter);
  }, [contexts, projectFilter]);

  const usedProjectNames = useMemo(() => {
    const names = new Set<string>();
    for (const context of contexts) {
      if (context.projectName) {
        names.add(context.projectName);
      }
    }
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [contexts]);

  const hasUnassigned = contexts.some((context) => context.projectName === null);

  async function downloadOne(context: CredentialContext) {
    setDownloadError(null);
    setDownloading(context.operation.id);
    try {
      const text = await buildCredentialBlock(context);
      downloadText(
        `slideops-${envKey(context.operation.capability_key).toLowerCase()}-${shortId(
          context.operation.id,
        )}.env`,
        text,
      );
    } catch (error) {
      setDownloadError(
        error instanceof Error ? error : new Error('This credential could not be prepared.'),
      );
    } finally {
      setDownloading(null);
    }
  }

  async function downloadAll() {
    setDownloadError(null);
    setDownloading('all');
    try {
      const blocks: string[] = [];
      for (const context of visible) {
        blocks.push(await buildCredentialBlock(context));
      }
      downloadText(ALL_FILE_NAME, blocks.join('\n\n'));
    } catch (error) {
      setDownloadError(
        error instanceof Error ? error : new Error('These credentials could not be prepared.'),
      );
    } finally {
      setDownloading(null);
    }
  }

  return (
    <OperatorShell active="credentials">
      <PageHeader
        title="Credentials"
        description="Every credential SlideOps created for you while running a Capability, such as a database password or a service secret, ready to reveal, copy, and download for another tool. SlideOps never holds your SSH private key, so it does not appear here."
        actions={
          visible.length > 0 ? (
            <Button
              variant="primary"
              size="sm"
              onClick={downloadAll}
              disabled={downloading !== null}
              aria-busy={downloading === 'all' || undefined}
            >
              {downloading === 'all' ? 'Preparing all' : 'Download all'}
            </Button>
          ) : undefined
        }
      />

      {state.status === 'loading' ? <Loading label="Loading your credentials" /> : null}
      {state.status === 'error' ? <ErrorNote error={state.error} /> : null}

      {state.status === 'ready' ? (
        contexts.length === 0 ? (
          <EmptyState
            icon={KeyRound}
            title="No stored credentials yet"
            description="When a Capability creates a credential for you, such as a database password, it appears here so you can reveal it, copy it, and download it to use in another tool."
          />
        ) : (
          <div className="flex flex-col gap-4">
            {downloadError ? (
              <div
                role="alert"
                className="rounded-md border border-border bg-subtle px-4 py-3 text-sm text-danger"
              >
                {downloadError.message}
              </div>
            ) : null}

            {usedProjectNames.length > 0 || hasUnassigned ? (
              <label className="flex items-center gap-2 text-sm text-ink-muted">
                <span>Project</span>
                <select
                  className={selectClass}
                  value={projectFilter}
                  onChange={(event) => setProjectFilter(event.target.value)}
                  aria-label="Filter credentials by Project"
                >
                  <option value="all">All Projects</option>
                  {usedProjectNames.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                  {hasUnassigned ? <option value="none">No Project</option> : null}
                </select>
              </label>
            ) : null}

            {visible.length === 0 ? (
              <EmptyState
                icon={KeyRound}
                title="No credentials in this Project"
                description="No stored credentials match this filter. Choose All Projects to see every credential SlideOps created for you."
              />
            ) : (
              visible.map((context) => (
                <CredentialSection
                  key={context.operation.id}
                  context={context}
                  onDownload={() => void downloadOne(context)}
                  downloading={downloading === context.operation.id}
                />
              ))
            )}
          </div>
        )
      ) : null}
    </OperatorShell>
  );
}
