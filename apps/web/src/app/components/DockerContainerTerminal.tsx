import { dockerContainerShellUrl } from '@slideops/api-client';
import { Card, Text } from '@slideops/design-system';
import { Info } from '@slideops/icons';
import { useCallback } from 'react';
import { useCanWrite } from '../../store/workspace';
import { ShellTerminal } from './ShellTerminal';

/*
 * A shell inside one container.
 *
 * The copy on this tab is the part that matters most, so it is worth saying why
 * it reads the way it does.
 *
 * SlideOps has one way onto a Node: the SSH connection the Operator gave it.
 * This shell is that connection, with a command run through it that attaches to
 * a process namespace on the same machine. Calling it anything else -- a
 * sandbox, a safe place to try things, somewhere separate from the server --
 * would be describing a boundary that is not there, and somebody would type a
 * command they would not have typed if they had known. An infrastructure tool
 * that oversells a boundary once has spent the trust it needs for every warning
 * it gives afterwards.
 *
 * So the panel says plainly what the connection is and what running things here
 * can reach. It is opened only when the Operator asks: a shell that connected on
 * page load would start a session on somebody's server because they clicked a
 * tab.
 */

export interface DockerContainerTerminalProps {
  nodeId: string;
  /** The Node's name, so the copy can say which machine this reaches. */
  nodeName: string;
  /** The container's id or name, as the daemon knows it. */
  containerRef: string;
  containerName: string;
  /** Whether the container is running. A stopped container has nothing to attach to. */
  running: boolean;
}

/** The Terminal tab: an honest shell inside the container, gated on write access. */
export function DockerContainerTerminal({
  nodeId,
  nodeName,
  containerRef,
  containerName,
  running,
}: DockerContainerTerminalProps) {
  const canWrite = useCanWrite();

  // Stable, because useShellSession takes it as a dependency of open().
  const urlFor = useCallback(
    (cols: number, rows: number) => dockerContainerShellUrl(nodeId, containerRef, cols, rows),
    [nodeId, containerRef],
  );

  if (!canWrite) {
    return (
      <Card className="flex flex-col gap-3">
        <Text variant="h4">A shell inside {containerName}</Text>
        <Text variant="body-sm" tone="secondary">
          Opening a shell runs commands on {nodeName}, so it needs write access in this workspace.
          Your role here is Viewer, which reads everything and changes nothing. An Owner or Admin of
          this workspace can change your role, or open the shell for you.
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
            This is a shell inside the container, reached over {nodeName}'s own SSH connection
          </Text>
          <Text variant="body-sm" tone="secondary" className="mt-1">
            SlideOps connects to {nodeName} over SSH exactly as it always does, and from there
            attaches a shell to {containerName}. It is not a sandbox and not a separate machine:
            whatever you run has the access the container's own processes have, on the same kernel
            as everything else on {nodeName}. Changes made in here are also lost the next time the
            container is recreated, because a new container starts from the image again.
          </Text>
        </div>
      </div>

      <ShellTerminal
        urlFor={urlFor}
        scopeLabel={`Shell inside ${containerName}`}
        scopeDetail={`Commands run inside ${containerName} on ${nodeName}, over the SSH connection SlideOps already has to that server.`}
        unavailableReason={
          running
            ? undefined
            : `${containerName} is not running, so there are no processes to attach a shell to. Start it first.`
        }
      />
    </div>
  );
}
