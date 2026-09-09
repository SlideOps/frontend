import { dockerContainerShellUrl, nodeShellUrl } from '@slideops/api-client';
import { Button, Card, Text } from '@slideops/design-system';
import { Container as ContainerIcon, Info, Server } from '@slideops/icons';
import { useCallback, useState } from 'react';
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
  /*
   * Two scopes, because the container is not always the place to look.
   *
   * A container in a restart loop is exactly the one that cannot be attached
   * to: by the time a shell would open, the process it would have attached to
   * is gone again. Offering only the container shell means the Operator is
   * refused precisely when they most need to look, and has to leave SlideOps
   * for a terminal to run the docker logs and docker inspect that would tell
   * them why. The server shell is the same connection this page already uses,
   * so it is nothing new to trust; it is simply the other end of it.
   */
  const [scope, setScope] = useState<'container' | 'server'>(running ? 'container' : 'server');

  const serverUrlFor = useCallback(
    (cols: number, rows: number) => nodeShellUrl(nodeId, cols, rows),
    [nodeId],
  );

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

      <div
        role="group"
        aria-label="Where the shell opens"
        className="flex flex-wrap items-center gap-2"
      >
        {[
          { key: 'container' as const, label: `Inside ${containerName}` },
          { key: 'server' as const, label: `On ${nodeName}` },
        ].map((option) => (
          <Button
            key={option.key}
            size="sm"
            variant={scope === option.key ? 'secondary' : 'ghost'}
            onClick={() => setScope(option.key)}
          >
            {option.key === 'container' ? (
              <ContainerIcon width={15} height={15} aria-hidden />
            ) : (
              <Server width={15} height={15} aria-hidden />
            )}
            {option.label}
          </Button>
        ))}
      </div>

      {scope === 'container' && !running ? (
        <Text variant="body-sm" tone="secondary">
          {containerName} is not running, so there is no process to attach to. Open a shell on{' '}
          {nodeName} instead and it can tell you why: its logs, its exit code, and its last
          configuration are all still on the server.
        </Text>
      ) : null}

      {scope === 'container' ? (
        <ShellTerminal
          urlFor={urlFor}
          scopeLabel={`Shell inside ${containerName}`}
          scopeDetail={`Commands run inside ${containerName} on ${nodeName}, over the SSH connection SlideOps already has to that server.`}
          unavailableReason={
            running
              ? undefined
              : `${containerName} is not running, so there are no processes to attach a shell to. Open a shell on ${nodeName} instead, or start it first.`
          }
        />
      ) : (
        <ShellTerminal
          urlFor={serverUrlFor}
          scopeLabel={`Shell on ${nodeName}`}
          scopeDetail={`Commands run on ${nodeName} itself, not inside any container. This is the same server shell the Node page opens, and it is what can answer why a container will not stay up: docker logs ${containerName}, docker inspect ${containerName}.`}
        />
      )}
    </div>
  );
}
