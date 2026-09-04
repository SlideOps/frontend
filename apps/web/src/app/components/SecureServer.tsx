import {
  getReadiness,
  type DiscoveryResult,
  type Node,
  type ReadinessMeasure,
} from '@slideops/api-client';
import { Button, Card, Text } from '@slideops/design-system';
import { ArrowRight, Check, CheckCircle2, Lock, RefreshCw, ShieldCheck } from '@slideops/icons';
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

/** Guidance keys that already have real registered content. Any Capability
 *  without an entry here renders no help bubble, which Guidance already
 *  handles gracefully. */
const GUIDANCE_KEY: Record<string, string> = {
  'create-app-user': 'server.secure.admin',
  'secure-ssh': 'server.secure.hardenSsh',
};

/**
 * The guided path through this server's own readiness baseline, in the same
 * dependency order the Capabilities tab and the Operation engine's hard gate
 * both use -- one underlying picture, three places it shows up.
 *
 * This used to be a fixed list of four steps that never changed and covered
 * only the very first three baseline measures. On a server secured weeks ago
 * it still read "Create a non-root administrator", as though nothing had
 * happened, while the readiness panel directly beneath it said the opposite.
 * Two components on one page disagreeing about the same server teaches an
 * Operator to trust neither, and stopping at three measures left out most of
 * how servers are actually lost: no firewall, no unattended updates, no
 * brute force protection.
 *
 * It reads the same readiness the rest of the page trusts, so a step SlideOps
 * carried out and a step the Operator did by hand before SlideOps ever saw the
 * machine both count. Detected counts as much as done: a server hardened by hand
 * is a hardened server. A measure the readiness report marks blocked shows why,
 * with no start action that the backend would only refuse.
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

  const discovered = readiness.state.status === 'ready' && readiness.state.data.discovered;
  // Satisfied first (already in baseline order), then missing in the
  // dependency-and-severity order the backend computed: since the hard gate
  // refuses any Operation out of order, a satisfied set can only ever be a
  // prefix of the correct order, so this concatenation is the true pipeline
  // order for everything, done or not.
  const measures: ReadinessMeasure[] =
    readiness.state.status === 'ready'
      ? [...readiness.state.data.satisfied, ...readiness.state.data.missing]
      : [];
  const titleFor = (key: string) => measures.find((m) => m.capability_key === key)?.title ?? key;

  const appUserDone = measures.some(
    (m) => m.capability_key === 'create-app-user' && (m.state === 'done' || m.state === 'detected'),
  );
  const sshDone = measures.some(
    (m) => m.capability_key === 'secure-ssh' && (m.state === 'done' || m.state === 'detected'),
  );
  // The connection is on the non-root account exactly when SlideOps is not
  // connecting as root, which the Node itself records.
  const everythingDone = discovered && appUserDone && sshDone;

  let stepIndex = 1;

  return (
    <Card>
      <div className="mb-4 flex items-center gap-2">
        <ShieldCheck width={20} height={20} className="text-brand" aria-hidden />
        <Text variant="h3">Secure this server</Text>
        <Guidance for="server.secure" />
      </div>
      <Text variant="body-sm" tone="secondary" className="mb-5">
        {readiness.state.status === 'ready' &&
        readiness.state.data.missing.length === 0 &&
        discovered
          ? 'This server is already secured according to the currently detected security requirements. Everything below is done, kept here so you can see what was applied and run any of it again if you need to.'
          : "SlideOps guides you through this server's own setup and security steps in the order they actually depend on each other, so a step is never offered before what it needs."}
      </Text>

      <ol className="flex flex-col gap-6">
        <Step
          index={stepIndex++}
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

        {measures.map((measure) => {
          const done = measure.state === 'done' || measure.state === 'detected';
          const blocked =
            !done && Boolean(measure.blocked) && (measure.blocked_by?.length ?? 0) > 0;
          const startHref = `/app/capabilities/${measure.capability_key}?node=${nodeId}`;

          const action = blocked ? (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => navigate(`/app/capabilities/${measure.blocked_by![0]}?node=${nodeId}`)}
            >
              <Lock width={15} height={15} aria-hidden />
              Complete {measure.blocked_by!.map(titleFor).join(', ')} first
            </Button>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="secondary" onClick={() => navigate(startHref)}>
                {measure.title}
                <ArrowRight width={15} height={15} aria-hidden />
              </Button>
              {measure.capability_key === 'create-app-user' ? (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => navigate(`/app/nodes/${nodeId}?tab=settings`)}
                >
                  Or create one with a generated key
                </Button>
              ) : null}
            </div>
          );

          return (
            <Step
              key={measure.capability_key}
              index={stepIndex++}
              guidanceKey={
                GUIDANCE_KEY[measure.capability_key] ?? `server.secure.${measure.capability_key}`
              }
              title={measure.title}
              done={done}
              evidence={measure.evidence ?? (done ? undefined : measure.why)}
              action={action}
            >
              {measure.why}
            </Step>
          );
        })}

        {appUserDone && sshDone ? (
          <Step
            index={stepIndex++}
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
            Point SlideOps at the non-root account. The new credential is verified before the
            switch, so a wrong one changes nothing and you are never locked out.
          </Step>
        ) : null}
      </ol>
    </Card>
  );
}
