import {
  ApiError,
  disableWorkspaceNetwork,
  enableWorkspaceNetwork,
  getWorkspaceNetwork,
  joinWorkspaceNetwork,
  listNodes,
  reconcileWorkspaceNetwork,
  type NetworkMember,
  type Node,
  type WorkspaceNetwork,
} from '@slideops/api-client';
import { Button, Section, Text } from '@slideops/design-system';
import { AlertTriangle, Check, Network, RefreshCw } from '@slideops/icons';
import { PageHeader } from '@slideops/ui';
import { useState } from 'react';
import { activeRole, useWorkspaceStore } from '../../store/workspace';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { DomainRouting } from '../components/DomainRouting';
import { ErrorNote, Loading } from '../components/Feedback';
import { OperatorShell } from '../components/OperatorShell';
import { useAsyncData } from '../hooks/useAsyncData';

/*
 * The Workspace private network.
 *
 * One page, and one thing on it that matters: whether the Workspace's Nodes can
 * reach each other. Everything else here answers the question an Operator asks
 * next, which is always "then why can this one not".
 *
 * A Node's state is deliberately not reduced to connected or broken. Pending is
 * work in progress, disabled is a decision, and failed is the only one that needs
 * anybody. Collapsing those three into "not connected" is what turns a page like
 * this into something people stop reading.
 */

/** How each member state reads, and whether it is something to act on. */
const MEMBER_STATES: Record<string, { label: string; tone: 'ok' | 'warn' | 'bad' | 'muted' }> = {
  joined: { label: 'Connected', tone: 'ok' },
  pending: { label: 'Joining', tone: 'warn' },
  failed: { label: 'Failed', tone: 'bad' },
  disabled: { label: 'Excluded', tone: 'muted' },
  removed: { label: 'Removed', tone: 'muted' },
};

function StateBadge({ state }: { state: string }) {
  const meta = MEMBER_STATES[state] ?? { label: state, tone: 'muted' as const };
  const tone =
    meta.tone === 'ok'
      ? 'text-success'
      : meta.tone === 'warn'
        ? 'text-warning'
        : meta.tone === 'bad'
          ? 'text-danger'
          : 'text-ink-muted';
  return <span className={`text-sm font-medium ${tone}`}>{meta.label}</span>;
}

export function Networking() {
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const role = activeRole(workspaces);
  const canAdminister = role === 'owner' || role === 'admin';

  const network = useAsyncData<WorkspaceNetwork>(() => getWorkspaceNetwork(), []);
  const nodes = useAsyncData<Node[]>(() => listNodes(), []);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDisable, setConfirmDisable] = useState(false);

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      network.reload();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'That did not work. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const data = network.state.status === 'ready' ? network.state.data : undefined;
  const members = data?.members ?? [];
  const memberByNode = new Map(members.map((m) => [m.node_id, m]));
  const allNodes = nodes.state.status === 'ready' ? nodes.state.data : [];
  const connected = members.filter((m) => m.reachable).length;
  const unjoined = allNodes.filter((n) => !memberByNode.has(n.id));

  return (
    <OperatorShell active="networking">
      <PageHeader
        title="Workspace network"
        description="One private path between the servers in this Workspace, so a Service on one can reach a database on another without opening anything to the internet."
      />

      {network.state.status === 'loading' ? <Loading /> : null}
      {network.state.status === 'error' ? <ErrorNote error={network.state.error} /> : null}

      {data ? (
        <>
          <Section
            title="Private network"
            adornment={<Network width={16} height={16} className="text-brand" aria-hidden />}
            description={
              data.enabled
                ? `On. Addresses are allocated from ${data.address_space}.`
                : 'Off. Servers in this Workspace can only reach each other over the public internet, which means a firewall rule for every database and every consumer.'
            }
          >
            <div className="flex flex-wrap items-center gap-3">
              <Text variant="body-sm" tone="secondary" className="flex-1">
                {data.enabled
                  ? `${connected} of ${allNodes.length} servers connected.`
                  : 'Turning this on reserves the address space. Servers join one at a time, and you can watch each one below.'}
              </Text>
              {canAdminister ? (
                data.enabled ? (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={busy}
                      onClick={() => run(reconcileWorkspaceNetwork)}
                    >
                      <RefreshCw width={15} height={15} aria-hidden />
                      Repair
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={busy}
                      onClick={() => setConfirmDisable(true)}
                    >
                      Turn off
                    </Button>
                  </>
                ) : (
                  <Button disabled={busy} onClick={() => run(enableWorkspaceNetwork)}>
                    {busy ? 'Turning on' : 'Turn on'}
                  </Button>
                )
              ) : (
                <Text variant="caption" tone="secondary">
                  Changing the network needs the Owner or an Admin.
                </Text>
              )}
            </div>

            {error ? (
              <p role="alert" className="mt-3 text-sm text-danger">
                {error}
              </p>
            ) : null}
          </Section>

          {data.enabled ? (
            <Section
              title="Servers"
              description="Which servers are on the network, and why any of them are not."
            >
              {members.length === 0 && unjoined.length === 0 ? (
                <Text variant="body-sm" tone="secondary">
                  This Workspace has no servers yet. Add one and it can join the network.
                </Text>
              ) : null}

              <div className="flex flex-col gap-2">
                {members.map((member) => (
                  <MemberRow
                    key={member.node_id}
                    member={member}
                    name={allNodes.find((n) => n.id === member.node_id)?.name ?? member.node_id}
                    canAdminister={canAdminister}
                    busy={busy}
                    onRetry={() => run(() => joinWorkspaceNetwork(member.node_id))}
                  />
                ))}

                {unjoined.map((node) => (
                  <div
                    key={node.id}
                    className="flex flex-wrap items-center gap-3 rounded-md border border-border px-4 py-3"
                  >
                    <div className="min-w-0 flex-1">
                      <Text variant="body-sm" className="font-medium">
                        {node.name}
                      </Text>
                      <Text variant="caption" tone="secondary">
                        Not on the network yet.
                      </Text>
                    </div>
                    {canAdminister ? (
                      <Button
                        size="sm"
                        disabled={busy}
                        onClick={() => run(() => joinWorkspaceNetwork(node.id))}
                      >
                        Join
                      </Button>
                    ) : null}
                  </div>
                ))}
              </div>
            </Section>
          ) : null}
        </>
      ) : null}

      {/* How the outside reaches this Workspace, below how its servers reach
          each other: two different layers, read in that order rather than
          mixed together. */}
      <DomainRouting canAdminister={canAdminister} />

      <ConfirmDialog
        open={confirmDisable}
        title="Turn off the Workspace network?"
        // Not a warning for its own sake: anything currently reaching another
        // server privately stops the moment this is off, and an Operator who has
        // wired a Service to a database on another Node is about to break it.
        description="Any Service reaching a database on another server over this network will stop working. Addresses are kept, so turning it back on restores the same layout rather than renumbering every server."
        confirmLabel="Turn off"
        onCancel={() => setConfirmDisable(false)}
        onConfirm={() => {
          setConfirmDisable(false);
          void run(disableWorkspaceNetwork);
        }}
      />
    </OperatorShell>
  );
}

/** One Node's row: its state, its address, and why it is not connected. */
function MemberRow({
  member,
  name,
  canAdminister,
  busy,
  onRetry,
}: {
  member: NetworkMember;
  name: string;
  canAdminister: boolean;
  busy: boolean;
  onRetry: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-md border border-border px-4 py-3">
      {member.reachable ? (
        <Check width={16} height={16} className="shrink-0 text-success" aria-hidden />
      ) : member.state === 'failed' ? (
        <AlertTriangle width={16} height={16} className="shrink-0 text-danger" aria-hidden />
      ) : null}
      <div className="min-w-0 flex-1">
        <Text variant="body-sm" className="font-medium">
          {name}
        </Text>
        <Text variant="caption" tone="secondary" className="font-mono">
          {member.network_address}
        </Text>
        {member.last_error ? (
          <Text variant="caption" tone="secondary" className="mt-1 block">
            {member.last_error}
          </Text>
        ) : null}
      </div>
      <StateBadge state={member.state} />
      {canAdminister && member.state === 'failed' ? (
        <Button variant="ghost" size="sm" disabled={busy} onClick={onRetry}>
          Retry
        </Button>
      ) : null}
    </div>
  );
}
