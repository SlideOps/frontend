import { celeryShellUrl } from '@slideops/api-client';
import { Card, Text } from '@slideops/design-system';
import { Info } from '@slideops/icons';
import { useCallback } from 'react';
import { useCanWrite } from '../../store/workspace';
import { ShellTerminal } from './ShellTerminal';

/*
 * A shell in a Celery worker's own working directory.
 *
 * A worker has no container to enter -- it is the application's own code,
 * running as whatever account the connection to this Node already is -- so
 * this lands on the server, in that directory, exactly the reasoning
 * SystemdShellCommand already uses for a systemd Service's own shell. It is
 * the same honest framing DockerContainerTerminal already gives a container
 * shell: this is SlideOps' one SSH connection to the Node, with `cd` run
 * through it, not a sandbox or a boundary that is not there.
 */

export interface CeleryWorkerTerminalProps {
  serviceId: string;
  /** The worker's configured working directory, which both identifies the
   * worker to the backend and is where this shell actually lands. */
  workingDirectory: string;
}

/** The Terminal section on the Celery worker's own page: a shell in its
 * working directory, gated on write access like every other shell. */
export function CeleryWorkerTerminal({ serviceId, workingDirectory }: CeleryWorkerTerminalProps) {
  const canWrite = useCanWrite();

  const urlFor = useCallback(
    (cols: number, rows: number) => celeryShellUrl(serviceId, workingDirectory, cols, rows),
    [serviceId, workingDirectory],
  );

  if (!canWrite) {
    return (
      <Card className="flex flex-col gap-3">
        <Text variant="h4">A shell in this worker&apos;s working directory</Text>
        <Text variant="body-sm" tone="secondary">
          Opening a shell runs commands on the server this worker is configured on, so it needs
          write access in this workspace. Your role here is Viewer, which reads everything and
          changes nothing.
        </Text>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-3 rounded-md border border-border bg-subtle px-4 py-3">
        <Info width={18} height={18} className="mt-0.5 shrink-0 text-info" aria-hidden />
        <div>
          <Text variant="body-sm" className="font-medium">
            This is a shell on the server, in {workingDirectory}
          </Text>
          <Text variant="body-sm" tone="secondary" className="mt-1">
            SlideOps connects over the same SSH connection it always does, and starts here because
            it is where this worker's own code and virtual environment live. A worker has no
            container to enter, so this is not confined to it: whatever you run has the access the
            connecting account has on this server.
          </Text>
        </div>
      </div>

      <ShellTerminal
        urlFor={urlFor}
        scopeLabel={`Shell in ${workingDirectory}`}
        scopeDetail={`Commands run in ${workingDirectory} on this worker's own server, over the SSH connection SlideOps already has to it.`}
      />
    </div>
  );
}
