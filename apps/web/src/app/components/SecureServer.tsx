import type { DiscoveryResult, Node } from '@slideops/api-client';
import { Button, Card, Text } from '@slideops/design-system';
import { ArrowRight, CheckCircle2, RefreshCw, ShieldCheck } from '@slideops/icons';
import { Guidance } from '@slideops/tooltips';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

/** A yes/no/unknown reading of an sshd directive from the last quick check. */
function directiveState(value: string | undefined): 'yes' | 'no' | 'unknown' {
  if (value === undefined) {
    return 'unknown';
  }
  return value.toLowerCase() === 'yes' ? 'yes' : 'no';
}

function PostureRow({ label, value, good }: { label: string; value: string; good: boolean | null }) {
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
          value={permitRoot === 'unknown' ? 'Unknown' : permitRoot === 'no' ? 'Disabled' : 'Permitted'}
          good={permitRoot === 'unknown' ? null : permitRoot === 'no'}
        />
        <PostureRow
          label="Password sign in"
          value={
            passwordAuth === 'unknown' ? 'Unknown' : passwordAuth === 'no' ? 'Off' : 'On'
          }
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
}: {
  index: number;
  guidanceKey: string;
  title: string;
  children: ReactNode;
  action: ReactNode;
}) {
  return (
    <li className="flex gap-4">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-subtle text-sm font-semibold text-brand">
        {index}
      </span>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <Text variant="body" className="font-medium">
            {title}
          </Text>
          <Guidance for={guidanceKey} />
        </div>
        <Text variant="body-sm" tone="secondary" className="mt-1">
          {children}
        </Text>
        <div className="mt-3">{action}</div>
      </div>
    </li>
  );
}

/**
 * The guided path to stop operating a server as root: run the quick check,
 * create a non-root administrator, harden SSH, then switch SlideOps to the new
 * account. Each step launches a normal Operation the Operator approves; the
 * final switch verifies the new account can sign in before it changes anything.
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

  return (
    <Card>
      <div className="mb-4 flex items-center gap-2">
        <ShieldCheck width={20} height={20} className="text-brand" aria-hidden />
        <Text variant="h3">Secure this server</Text>
        <Guidance for="server.secure" />
      </div>
      <Text variant="body-sm" tone="secondary" className="mb-5">
        SlideOps should never operate a server as root once it is connected. Follow these steps in
        order to create a non-root administrator, harden SSH, then switch to the new account.
      </Text>

      <ol className="flex flex-col gap-6">
        <Step
          index={1}
          guidanceKey="server.secure.discover"
          title="Run the quick check"
          action={
            <Button size="sm" variant="secondary" onClick={onDiscover} disabled={discovering}>
              <RefreshCw
                width={15}
                height={15}
                className={discovering ? 'animate-spin' : undefined}
                aria-hidden
              />
              {discovering ? 'Reading the server' : 'Run the quick check'}
            </Button>
          }
        >
          Read the server over SSH first so the steps that follow are planned from what is really
          there. It changes nothing.
        </Step>
        <Step
          index={2}
          guidanceKey="server.secure.admin"
          title="Create a non-root administrator"
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
