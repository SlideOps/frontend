import { getReadiness, type DiscoveryResult, type Node } from '@slideops/api-client';
import { Button, Card, Text } from '@slideops/design-system';
import { ArrowRight, Check, CheckCircle2, RefreshCw, ShieldCheck } from '@slideops/icons';
import { Guidance } from '@slideops/tooltips';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCanWrite } from '../../store/workspace';
import { useAsyncData } from '../hooks/useAsyncData';

/** A yes/no/unknown reading of an sshd directive from the last quick check. */
function directiveState(value: string | undefined): 'yes' | 'no' | 'unknown' {
  if (value === undefined) {
    return 'unknown';
  }
  return value.toLowerCase() === 'yes' ? 'yes' : 'no';
}

function PostureRow({
  label,
  value,
  good,
}: {
  label: string;
  value: string;
  good: boolean | null;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <span className="text-sm text-ink-muted">{label}</span>
      <span
        className={`text-sm font-medium ${
          good === null ? 'text-ink-muted' : good ? 'text-success' : 'text-warning'
        }`}
      >
        {value}
      </span>
    </div>
  );
}

/**
 * The server's security posture: the account SlideOps signs in as and, from the
 * last quick check, whether root sign in and password sign in are still on.
 * Anything the quick check has not read is shown as unknown, never guessed.
 */
export function ServerPosture({ node, facts }: { node: Node; facts?: DiscoveryResult['facts'] }) {
  const permitRoot = directiveState(facts?.ssh_posture?.permit_root_login);
  const passwordAuth = directiveState(facts?.ssh_posture?.password_authentication);
  const isRoot = node.ssh_username === 'root';

  return (
    <Card className="h-fit">
      <div className="mb-3 flex items-center gap-2">
        <ShieldCheck width={18} height={18} className="text-brand" aria-hidden />
        <Text variant="h4">Security posture</Text>
        <Guidance for="server.posture" />
      </div>
      <dl className="divide-y divide-border">
        <PostureRow
          label="Connection account"
          value={node.ssh_username}
          good={isRoot ? false : true}
        />
        <PostureRow
          label="Root sign in over SSH"
          value={
            permitRoot === 'unknown' ? 'Unknown' : permitRoot === 'no' ? 'Disabled' : 'Permitted'
          }
          good={permitRoot === 'unknown' ? null : permitRoot === 'no'}
        />
        <PostureRow
          label="Password sign in"
          value={passwordAuth === 'unknown' ? 'Unknown' : passwordAuth === 'no' ? 'Off' : 'On'}
          good={passwordAuth === 'unknown' ? null : passwordAuth === 'no'}
        />
      </dl>
      {isRoot ? (
        <Text variant="body-sm" tone="secondary" className="mt-3">
          SlideOps still signs in as root. Follow the steps below to move to a non-root
          administrator and drop root.
        </Text>
      ) : null}
    </Card>
  );
}

function Step({
  index,
  guidanceKey,
  title,
  children,
  action,
  done = false,
  evidence,
}: {
  index: number;
  guidanceKey: string;
  title: string;
  children: ReactNode;
  action: ReactNode;
  /** Already true on this server, whether SlideOps did it or found it that way. */
  done?: boolean;
  /** How it was decided, so a claim of done can be checked rather than believed. */
  evidence?: string;
}) {
  return (
    <li className="flex gap-4">
      <span
        className={
          done
            ? 'flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-success/15 text-success'
            : 'flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-subtle text-sm font-semibold text-brand'
        }
      >
        {done ? <Check width={15} height={15} aria-hidden /> : index}
      </span>
      <div className="flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Text variant="body" className={done ? 'font-medium text-ink-muted' : 'font-medium'}>
            {title}
          </Text>
          {done ? (
            <span className="rounded-pill bg-success/15 px-2 py-0.5 text-xs font-medium text-success">
              Done
            </span>
          ) : null}
          <Guidance for={guidanceKey} />
        </div>
        <Text variant="body-sm" tone="secondary" className="mt-1">
          {done && evidence ? evidence : children}
        </Text>
        {/* A step already satisfied keeps its control, because running it again is
            sometimes exactly what an Operator wants, but it stops being presented
            as the next thing to do. */}
        <div className="mt-3">{action}</div>
      </div>
    </li>
  );
}

/**
 * The guided path to stop operating a server as root.
 *
 * This used to be a fixed list of four steps that never changed. On a server
 * secured weeks ago it still read "Create a non-root administrator", as though
 * nothing had happened, while the readiness panel directly beneath it said the
 * opposite. Two components on one page disagreeing about the same server teaches
 * an Operator to trust neither.
 *
 * It reads the same readiness the rest of the page trusts, so a step SlideOps
 * carried out and a step the Operator did by hand before SlideOps ever saw the
 * machine both count. Detected counts as much as done: a server hardened by hand
 * is a hardened server.
 */
export function SecureServer({
  nodeId,
  onDiscover,
  discovering,
  onRotate,
}: {
  nodeId: string;
  onDiscover: () => void;
  discovering: boolean;
  onRotate: () => void;
}) {
  const navigate = useNavigate();
  const canWrite = useCanWrite();
  const readiness = useAsyncData((signal) => getReadiness(nodeId, signal), [nodeId]);

  // Every measure the report knows about, satisfied or not, keyed by Capability.
  const measures =
    readiness.state.status === 'ready'
      ? [...readiness.state.data.satisfied, ...readiness.state.data.missing]
      : [];
  const satisfied = (key: string) => {
    const measure = measures.find((entry) => entry.capability_key === key);
    return {
      done: measure?.state === 'done' || measure?.state === 'detected',
      evidence: measure?.evidence,
    };
  };

  const discovered = readiness.state.status === 'ready' && readiness.state.data.discovered;
  const appUser = satisfied('create-app-user');
  const ssh = satisfied('secure-ssh');
  // The connection is on the non-root account exactly when SlideOps is not
  // connecting as root, which the Node itself records.
  const everythingDone = discovered && appUser.done && ssh.done;

  return (
    <Card>
      <div className="mb-4 flex items-center gap-2">
        <ShieldCheck width={20} height={20} className="text-brand" aria-hidden />
        <Text variant="h3">Secure this server</Text>
        <Guidance for="server.secure" />
      </div>
      <Text variant="body-sm" tone="secondary" className="mb-5">
        {everythingDone
          ? 'This server is already secured. Everything below is done, kept here so you can see what was applied and run any of it again if you need to.'
          : 'SlideOps should never operate a server as root once it is connected. Follow these steps in order to create a non-root administrator, harden SSH, then switch to the new account.'}
      </Text>

      <ol className="flex flex-col gap-6">
        <Step
          index={1}
          guidanceKey="server.secure.discover"
          title="Run the quick check"
          done={discovered}
          evidence={
            discovered
              ? 'This server has been read, so the steps below are planned from what is really there.'
              : undefined
          }
          action={
            canWrite ? (
              <Button size="sm" variant="secondary" onClick={onDiscover} disabled={discovering}>
                <RefreshCw
                  width={15}
                  height={15}
                  className={discovering ? 'animate-spin' : undefined}
                  aria-hidden
                />
                {discovering ? 'Reading the server' : 'Run the quick check'}
              </Button>
            ) : undefined
          }
        >
          Read the server over SSH first so the steps that follow are planned from what is really
          there. It changes nothing.
        </Step>
        <Step
          index={2}
          guidanceKey="server.secure.admin"
          title="Create a non-root administrator"
          done={appUser.done}
          evidence={appUser.evidence}
          action={
            <Button
              size="sm"
              variant="secondary"
              onClick={() => navigate(`/app/capabilities/create-app-user?node=${nodeId}`)}
            >
              Create the administrator
              <ArrowRight width={15} height={15} aria-hidden />
            </Button>
          }
        >
          Create a dedicated account with full sudo and a public key you hold, so SlideOps never has
          to sign in as root. This opens an Operation you approve.
        </Step>
        <Step
          index={3}
          guidanceKey="server.secure.hardenSsh"
          title="Harden SSH"
          done={ssh.done}
          evidence={ssh.evidence}
          action={
            <Button
              size="sm"
              variant="secondary"
              onClick={() => navigate(`/app/capabilities/secure-ssh?node=${nodeId}`)}
            >
              Harden SSH
              <ArrowRight width={15} height={15} aria-hidden />
            </Button>
          }
        >
          Turn off direct root sign in, so the only way in is the non-root account you created. Do
          this only after that account exists and works, so you are never left without a way in.
        </Step>
        <Step
          index={4}
          guidanceKey="server.secure.rotate"
          title="Switch to the new account"
          done={everythingDone}
          evidence={
            everythingDone ? 'SlideOps is connected on a non-root account with sudo.' : undefined
          }
          action={
            <Button size="sm" onClick={onRotate}>
              <CheckCircle2 width={15} height={15} aria-hidden />
              Switch the connection
            </Button>
          }
        >
          Point SlideOps at the non-root account. The new credential is verified before the switch,
          so a wrong one changes nothing and you are never locked out.
        </Step>
      </ol>
    </Card>
  );
}
