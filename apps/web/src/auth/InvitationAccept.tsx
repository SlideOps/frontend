import { ApiError, acceptInvitation, declineInvitation, getInvitation } from '@slideops/api-client';
import { Button, Text } from '@slideops/design-system';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AuthLayout } from '../components/AuthLayout';
import { Splash } from '../components/RequireAuth';
import { useAsyncData } from '../app/hooks/useAsyncData';
import { useAuthStore } from '../store/auth';
import { useWorkspaceStore } from '../store/workspace';

const roleLabel: Record<string, string> = {
  admin: 'Admin',
  member: 'Member',
  viewer: 'Viewer',
};

/**
 * Where an invitation link lands. It reads what the invitation offers with no
 * session required, then asks for sign in or an account when the visitor has
 * neither, sending them right back here afterward rather than losing them to
 * the ordinary Workspace home. Once signed in, one click links the invitation
 * to that account, unless its email does not match, which is refused rather
 * than silently accepted into the wrong account.
 */
export function InvitationAccept() {
  const { token = '' } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const authStatus = useAuthStore((state) => state.status);
  const operator = useAuthStore((state) => state.operator);
  const signOut = useAuthStore((state) => state.signOut);
  const refreshWorkspaces = useWorkspaceStore((state) => state.refresh);
  const resetWorkspaces = useWorkspaceStore((state) => state.reset);

  const { state } = useAsyncData(() => getInvitation(token), [token]);

  const [accepting, setAccepting] = useState(false);
  const [acceptError, setAcceptError] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [declining, setDeclining] = useState(false);
  const [declineError, setDeclineError] = useState<string | null>(null);
  const [declined, setDeclined] = useState(false);

  const next = `/invitations/${token}`;

  const accept = async () => {
    setAccepting(true);
    setAcceptError(null);
    try {
      await acceptInvitation(token);
      await refreshWorkspaces();
      setAccepted(true);
    } catch (caught) {
      setAcceptError(
        caught instanceof ApiError ? caught.message : 'This invitation could not be accepted.',
      );
    } finally {
      setAccepting(false);
    }
  };

  const decline = async () => {
    setDeclining(true);
    setDeclineError(null);
    try {
      await declineInvitation(token);
      setDeclined(true);
    } catch (caught) {
      setDeclineError(
        caught instanceof ApiError ? caught.message : 'This invitation could not be declined.',
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
    return <Splash label="Reading this invitation" />;
  }

  if (state.status === 'error') {
    return (
      <AuthLayout title="This invitation isn't available" description={state.error.message}>
        <Link to="/" className="block text-center text-sm font-medium text-accent hover:text-brand">
          Return to SlideOps
        </Link>
      </AuthLayout>
    );
  }

  const invitation = state.data;
  const role = roleLabel[invitation.role] ?? invitation.role;

  if (accepted) {
    return (
      <AuthLayout
        title="You're in"
        description={`You now have ${role} access in ${invitation.workspace_name}.`}
      >
        <Button size="lg" className="w-full" onClick={() => navigate('/app', { replace: true })}>
          Open the workspace
        </Button>
      </AuthLayout>
    );
  }

  if (declined) {
    return (
      <AuthLayout
        title="Invitation declined"
        description={`You will not join ${invitation.workspace_name}. Nothing else changes.`}
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
        title="You're invited"
        description={`You were invited to ${invitation.workspace_name} as ${role.toLowerCase() === 'admin' ? 'an' : 'a'} ${role}. Sign in or create an account to accept.`}
      >
        <div className="flex flex-col gap-3">
          <Button
            size="lg"
            className="w-full"
            onClick={() => navigate('/login', { state: { next } })}
          >
            Sign in to accept
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

  return (
    <AuthLayout
      title="You're invited"
      description={`You were invited to ${invitation.workspace_name} as ${role.toLowerCase() === 'admin' ? 'an' : 'a'} ${role}.`}
    >
      <div className="flex flex-col gap-3">
        <Text variant="body-sm" tone="secondary">
          Signed in as {operator?.email}.
        </Text>
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
        <Button
          size="lg"
          className="w-full"
          disabled={accepting || declining}
          onClick={() => void accept()}
        >
          {accepting ? 'Accepting' : 'Accept invitation'}
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
