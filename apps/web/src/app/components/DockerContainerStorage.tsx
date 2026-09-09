import type { DockerInspect, DockerMount } from '@slideops/api-client';
import { Card, Text } from '@slideops/design-system';
import { Database } from '@slideops/icons';

/*
 * What this container has mounted, and what survives it.
 *
 * The question an Operator is actually asking on this tab is never "what is the
 * mount table". It is "if I remove this container, what is gone". So the table
 * answers that in a column of its own, because the difference between a named
 * volume and a tmpfs is the difference between a database that still exists
 * tomorrow and one that does not, and nothing in the raw mount table says so out
 * loud.
 */

/**
 * What each kind of mount is, and what happens to it when the container goes.
 *
 * `volume` covers both named and anonymous volumes, and they do not have the
 * same answer, so the name decides: a named volume outlives every container
 * that mounts it, and an anonymous one is the thing "also delete its anonymous
 * volumes" deletes.
 */
function survival(mount: DockerMount): { label: string; tone: string } {
  const type = mount.type.toLowerCase();
  if (type === 'tmpfs') {
    return { label: 'Lost on stop', tone: 'text-warning' };
  }
  if (type === 'bind') {
    return { label: 'Stays on the server', tone: 'text-ink-muted' };
  }
  if (type === 'volume') {
    return mount.name
      ? { label: 'Survives removal', tone: 'text-success' }
      : { label: 'Deleted with the container, if you ask', tone: 'text-warning' };
  }
  // A mount type nobody here anticipated is reported rather than guessed at.
  return { label: 'Not known', tone: 'text-ink-muted' };
}

/** How each mount type reads, in words rather than in Docker's vocabulary. */
function typeLabel(mount: DockerMount): string {
  const type = mount.type.toLowerCase();
  if (type === 'volume') {
    return mount.name ? 'Named volume' : 'Anonymous volume';
  }
  if (type === 'bind') {
    return 'Path on the server';
  }
  if (type === 'tmpfs') {
    return 'Memory only';
  }
  return mount.type;
}

export interface DockerContainerStorageProps {
  inspect: DockerInspect;
  containerName: string;
  nodeName: string;
}

/** The Mounts tab: every filesystem attached to the container, and its fate. */
export function DockerContainerStorage({
  inspect,
  containerName,
  nodeName,
}: DockerContainerStorageProps) {
  const mounts = inspect.storage.mounts;

  if (mounts.length === 0) {
    return (
      <Card className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Database width={18} height={18} className="text-brand" aria-hidden />
          <Text variant="h4">Storage</Text>
        </div>
        <Text variant="body-sm" tone="secondary">
          {containerName} has nothing mounted. Everything it writes goes to its own writable layer,
          which is deleted with the container. Nothing it has written so far would survive being
          removed.
        </Text>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Database width={18} height={18} className="text-brand" aria-hidden />
        <Text variant="h4">Storage</Text>
      </div>

      <Text variant="body-sm" tone="secondary">
        {mounts.length} {mounts.length === 1 ? 'filesystem is' : 'filesystems are'} attached to{' '}
        {containerName}. Anything written anywhere else goes to the container's own writable layer
        and is deleted with it.
      </Text>

      {/* Wide on purpose, and allowed to scroll sideways inside its own box: a
          bind mount's source is a full path on the server, and truncating it
          hides which directory is exposed, which is the one thing worth
          reading. */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[46rem] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="py-2 pr-4 text-xs font-medium text-ink-muted">Kind</th>
              <th className="py-2 pr-4 text-xs font-medium text-ink-muted">
                Source on {nodeName}
              </th>
              <th className="py-2 pr-4 text-xs font-medium text-ink-muted">Inside the container</th>
              <th className="py-2 pr-4 text-xs font-medium text-ink-muted">Access</th>
              <th className="py-2 text-xs font-medium text-ink-muted">If removed</th>
            </tr>
          </thead>
          <tbody>
            {mounts.map((mount) => {
              const fate = survival(mount);
              return (
                <tr
                  key={`${mount.type}:${mount.source}:${mount.destination}`}
                  className="border-b border-border last:border-b-0 align-top"
                >
                  <td className="py-2.5 pr-4 text-ink">{typeLabel(mount)}</td>
                  <td className="py-2.5 pr-4 font-mono text-xs text-ink-muted">
                    {/* A tmpfs has no source at all. A dash is the honest value;
                        an empty cell reads as a rendering fault. */}
                    {mount.name ?? (mount.source ? mount.source : '--')}
                  </td>
                  <td className="py-2.5 pr-4 font-mono text-xs text-ink">{mount.destination}</td>
                  <td className="py-2.5 pr-4 text-ink-muted">
                    {mount.read_only ? 'Read only' : 'Read and write'}
                  </td>
                  <td className={`py-2.5 ${fate.tone}`}>{fate.label}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Text variant="body-sm" tone="secondary">
        A named volume outlives every container that mounts it, so removing this one leaves its data
        where it is. An anonymous volume is the one that "also delete its anonymous volumes" deletes
        when you remove the container. A path on {nodeName} belongs to the server and is never
        touched by removing a container.
      </Text>
    </Card>
  );
}
