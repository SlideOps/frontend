import {
  ApiError,
  acceptNodeTransfer,
  declineNodeTransfer,
  getNodeTransferPreview,
  listWorkspaces,
} from '@slideops/api-client';
import { Button, Text } from '@slideops/design-system';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AuthLayout } from '../components/AuthLayout';
import { Splash } from '../components/RequireAuth';
import { useAsyncData } from '../app/hooks/useAsyncData';
import { useAuthStore } from '../store/auth';
import { useWorkspaceStore } from '../store/workspace';

const selectClass =
  'h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus';

/**
 * Where a node transfer link lands. It reads what is on offer with no
 * session required, then asks for sign in or an account when the visitor has
 * neither, sending them right back here afterward. Once signed in, accepting
 * moves the node, and everything on it, into the Personal workspace by
 * default, or into another workspace this account created, chosen from a
 * picker shown only when there is more than one to choose from. The email
 * mismatch refusal, and declining, work the same as an ordinary workspace
 * invitation.
 */
export function NodeTransferAccept() {
  const { token = '' } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const authStatus = useAuthStore((state) => state.status);
  const operator = useAuthStore((state) => state.operator);
  const signOut = useAuthStore((state) => state.signOut);
  const refreshWorkspaces = useWorkspaceStore((state) => state.refresh);
  const resetWorkspaces = useWorkspaceStore((state) => state.reset);

  const { state } = useAsyncData(() => getNodeTransferPreview(token), [token]);
  const ownedWorkspaces = useAsyncData(
    () => (authStatus === 'authenticated' ? listWorkspaces() : Promise.resolve([])),
    [authStatus],
  );

  const [destination, setDestination] = useState('');
  const [accepting, setAccepting] = useState(false);
  const [acceptError, setAcceptError] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [declining, setDeclining] = useState(false);
  const [declineError, setDeclineError] = useState<string | null>(null);
  const [declined, setDeclined] = useState(false);

  const next = `/node-transfers/${token}`;

  const accept = async () => {
    setAccepting(true);
    setAcceptError(null);
    try {
      await acceptNodeTransfer(token, destination || undefined);
      await refreshWorkspaces();
      setAccepted(true);
    } catch (caught) {
      setAcceptError(
        caught instanceof ApiError ? caught.message : 'This transfer could not be accepted.',
      );
    } finally {
      setAccepting(false);
    }
  };

  const decline = async () => {
    setDeclining(true);
    setDeclineError(null);
    try {
      await declineNodeTransfer(token);
      setDeclined(true);
    } catch (caught) {
      setDeclineError(
        caught instanceof ApiError ? caught.message : 'This transfer could not be declined.',
      );
    } finally {
      setDeclining(false);
    }
  };

  const switchAccount = async () => {
    await signOut();
    resetWorkspaces();
    navigate('/login', { state: { next } });
  };

  if (authStatus === 'loading' || state.status === 'loading') {
    return <Splash label="Reading this transfer" />;
  }

  if (state.status === 'error') {
    return (
      <AuthLayout title="This transfer isn't available" description={state.error.message}>
        <Link to="/" className="block text-center text-sm font-medium text-accent hover:text-brand">
          Return to SlideOps
        </Link>
      </AuthLayout>
    );
  }

  const preview = state.data;

  if (accepted) {
    return (
      <AuthLayout
        title="It's yours"
        description={`${preview.node_name} is now in your workspace, with everything that was on it.`}
      >
        <Button size="lg" className="w-full" onClick={() => navigate('/app', { replace: true })}>
          Open it
        </Button>
      </AuthLayout>
    );
  }

  if (declined) {
    return (
      <AuthLayout
        title="Transfer declined"
        description={`You will not receive ${preview.node_name}. Nothing else changes.`}
      >
        <Button size="lg" className="w-full" onClick={() => navigate('/app', { replace: true })}>
          Go to SlideOps
        </Button>
      </AuthLayout>
    );
  }

  if (authStatus === 'anonymous') {
    return (
      <AuthLayout
        title="A node is being offered to you"
        description={`${preview.from_workspace_name} wants to transfer ${preview.node_name}, and everything on it, to your account. Sign in or create an account to review it.`}
      >
        <div className="flex flex-col gap-3">
          <Button size="lg" className="w-full" onClick={() => navigate('/login', { state: { next } })}>
            Sign in to review
          </Button>
          <Button
            size="lg"
            variant="secondary"
            className="w-full"
            onClick={() => navigate('/register', { state: { next } })}
          >
            Create an account
          </Button>
        </div>
      </AuthLayout>
    );
  }

  const owned =
    ownedWorkspaces.state.status === 'ready'
      ? ownedWorkspaces.state.data.filter((workspace) => workspace.role === 'owner')
      : [];

  return (
    <AuthLayout
      title="A node is being offered to you"
      description={`${preview.from_workspace_name} wants to transfer ${preview.node_name}, and everything on it, to your account.`}
    >
      <div className="flex flex-col gap-4">
        <Text variant="body-sm" tone="secondary">
          Signed in as {operator?.email}.
        </Text>
        {preview.message ? (
          <div className="rounded-md border border-border bg-subtle p-3">
            <Text variant="body-sm" className="text-ink">
              &ldquo;{preview.message}&rdquo;
            </Text>
          </div>
        ) : null}

        {owned.length > 1 ? (
          <div className="flex flex-col gap-2">
            <label htmlFor="transfer-destination" className="text-sm font-medium text-ink">
              Receive it into
            </label>
            <select
              id="transfer-destination"
              className={selectClass}
              value={destination}
              onChange={(event) => setDestination(event.target.value)}
            >
              {owned.map((workspace) => (
                <option key={workspace.id} value={workspace.is_personal ? '' : workspace.id}>
                  {workspace.name}
                  {workspace.is_personal ? ' (Personal)' : ''}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        {acceptError ? (
          <p role="alert" className="text-sm text-danger">
            {acceptError}
          </p>
        ) : null}
        {declineError ? (
          <p role="alert" className="text-sm text-danger">
            {declineError}
          </p>
        ) : null}
        <Button size="lg" className="w-full" disabled={accepting || declining} onClick={() => void accept()}>
          {accepting ? 'Accepting' : 'Accept this node'}
        </Button>
        <Button
          size="lg"
          variant="secondary"
          className="w-full"
          disabled={accepting || declining}
          onClick={() => void decline()}
        >
          {declining ? 'Declining' : 'Decline'}
        </Button>
        <button
          type="button"
          onClick={() => void switchAccount()}
          className="text-sm font-medium text-accent hover:text-brand"
        >
          Sign in with a different account
        </button>
      </div>
    </AuthLayout>
  );
}
