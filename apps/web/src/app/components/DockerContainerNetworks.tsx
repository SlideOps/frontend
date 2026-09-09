import type { DockerInspect, DockerPort } from '@slideops/api-client';
import { Card, Text } from '@slideops/design-system';
import { Network } from '@slideops/icons';
import { CopyButton } from './CopyButton';

/*
 * What this container is attached to, and what can reach it.
 *
 * The distinction this tab exists to make: a published port is reachable from
 * the server's own network, and an exposed one is reachable only by other
 * containers on the same Docker network. They look almost identical in Docker's
 * output and mean entirely different things to anybody thinking about what is
 * exposed to the internet, so they are never shown as the same row here.
 */

/** One published port, in the direction it is read: from outside, inwards. */
function portText(port: DockerPort): string {
  const inside = `${port.container_port}/${port.protocol}`;
  if (typeof port.host_port !== 'number') {
    return inside;
  }
  const host = port.host_ip ? `${port.host_ip}:${port.host_port}` : String(port.host_port);
  return `${host} to ${inside}`;
}

export interface DockerContainerNetworksProps {
  inspect: DockerInspect;
  containerName: string;
  nodeName: string;
}

/** The Networks tab: the networks joined, the addresses on them, and the ports. */
export function DockerContainerNetworks({
  inspect,
  containerName,
  nodeName,
}: DockerContainerNetworksProps) {
  const networking = inspect.networking;
  const published = networking.ports.filter((port) => typeof port.host_port === 'number');
  const internal = networking.ports.filter((port) => typeof port.host_port !== 'number');

  return (
    <div className="flex flex-col gap-6">
      <Card className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <Network width={18} height={18} className="text-brand" aria-hidden />
          <Text variant="h4">Networks</Text>
        </div>

        {networking.networks.length === 0 ? (
          <Text variant="body-sm" tone="secondary">
            {containerName} is on no Docker network. Nothing reaches it over the network, and it
            reaches nothing.
          </Text>
        ) : (
          <ul className="rounded-md border border-border">
            {networking.networks.map((network) => {
              const address = networking.ip_addresses[network];
              return (
                <li
                  key={network}
                  className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-border px-4 py-3 first:border-t-0"
                >
                  <span className="text-sm font-medium text-ink">{network}</span>
                  <span className="flex items-center gap-1 font-mono text-xs text-ink-muted">
                    {/* An address the daemon did not report is a dash. A blank
                        cell reads as an address of nothing. */}
                    {address ? address : '--'}
                    {address ? (
                      <CopyButton value={address} label={`the address of ${containerName} on ${network}`} />
                    ) : null}
                  </span>
                </li>
              );
            })}
          </ul>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Text variant="caption" tone="secondary" className="block">
              Hostname inside Docker
            </Text>
            <span className="mt-0.5 block font-mono text-sm text-ink">
              {networking.hostname ? networking.hostname : '--'}
            </span>
          </div>
          <div>
            <Text variant="caption" tone="secondary" className="block">
              DNS servers
            </Text>
            <span className="mt-0.5 block font-mono text-sm text-ink">
              {networking.dns.length > 0 ? networking.dns.join(', ') : '--'}
            </span>
          </div>
        </div>
      </Card>

      <Card className="flex flex-col gap-4">
        <Text variant="h4">Ports</Text>

        <div>
          <Text variant="body-sm" className="font-medium">
            Published to {nodeName}
          </Text>
          <Text variant="body-sm" tone="secondary" className="mt-1">
            Reachable from the server's own network. Whether that means reachable from the internet
            depends on the firewall on {nodeName}, which is a separate question from this one.
          </Text>
          {published.length === 0 ? (
            <Text variant="body-sm" tone="secondary" className="mt-2">
              None. Nothing on {nodeName} can reach this container by port.
            </Text>
          ) : (
            <div className="mt-2 flex flex-wrap gap-2">
              {published.map((port) => (
                <span
                  key={`${port.container_port}/${port.protocol}/${port.host_port}`}
                  className="rounded-md border border-border px-2 py-0.5 font-mono text-xs text-ink"
                >
                  {portText(port)}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-border pt-4">
          <Text variant="body-sm" className="font-medium">
            Inside Docker only
          </Text>
          <Text variant="body-sm" tone="secondary" className="mt-1">
            Reachable by other containers on the same network and by nothing else. This is the
            ordinary shape for a database behind a Compose network, and it does not mean the port is
            closed.
          </Text>
          {internal.length === 0 ? (
            <Text variant="body-sm" tone="secondary" className="mt-2">
              None.
            </Text>
          ) : (
            <div className="mt-2 flex flex-wrap gap-2">
              {internal.map((port) => (
                <span
                  key={`${port.container_port}/${port.protocol}`}
                  className="rounded-md border border-border px-2 py-0.5 font-mono text-xs text-ink-muted"
                >
                  {portText(port)}
                </span>
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
