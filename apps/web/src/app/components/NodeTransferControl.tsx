import {
  ApiError,
  cancelNodeTransfer,
  getPendingNodeTransfer,
  initiateNodeTransfer,
  type Node,
  type NodeTransfer,
} from '@slideops/api-client';
import { Button, Card, Field, Text } from '@slideops/design-system';
import { ArrowRightLeft } from '@slideops/icons';
import { Guidance } from '@slideops/tooltips';
import { type FormEvent, useState } from 'react';
import { activeRole, useWorkspaceStore } from '../../store/workspace';
import { useAsyncData } from '../hooks/useAsyncData';
import { ConfirmDialog } from './ConfirmDialog';
import { Loading } from './Feedback';

/** Reads the Node's outstanding transfer, treating not_found as "none". */
async function loadPending(nodeId: string, signal: AbortSignal): Promise<NodeTransfer | null> {
  try {
    return await getPendingNodeTransfer(nodeId, signal);
  } catch (error) {
    if (error instanceof ApiError && error.code === 'not_found') {
      return null;
    }
    throw error;
  }
}

/**
 * Hand this Node, and everything scoped beneath it (its Project if
 * exclusive, every Service, installed Plugins, history, credential), to a
 * different Operator account entirely. Nothing moves until that Operator
 * accepts. Owner or Admin only, the same as team management, since giving
 * away a resource the whole workspace built is that kind of decision.
 */
export function NodeTransferControl({ node }: { node: Node }) {
  const workspaces = useWorkspaceStore((state) => state.workspaces);
  const role = activeRole(workspaces);
  const canManage = role === 'owner' || role === 'admin';

  const { state, reload, refreshing } = useAsyncData(
    (signal) => loadPending(node.id, signal),
    [node.id],
  );

  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [reviewing, setReviewing] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [canceling, setCanceling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const review = (event: FormEvent) => {
    event.preventDefault();
    setFormError(null);
    setReviewing(true);
  };

  const confirm = async () => {
    try {
      await initiateNodeTransfer(node.id, email.trim(), message.trim());
      setEmail('');
      setMessage('');
      reload();
    } catch (caught) {
      setFormError(
        caught instanceof ApiError ? caught.message : 'That transfer could not be started.',
      );
    } finally {
      setReviewing(false);
    }
  };

  const cancel = async () => {
    setCanceling(true);
    setCancelError(null);
    try {
      await cancelNodeTransfer(node.id);
      reload();
    } catch (caught) {
      setCancelError(
        caught instanceof ApiError ? caught.message : 'That transfer could not be canceled.',
      );
    } finally {
      setCanceling(false);
    }
  };

  if (!canManage) {
    return (
      <Card>
        <div className="mb-3 flex items-center gap-2">
          <ArrowRightLeft width={18} height={18} className="text-brand" aria-hidden />
          <Text variant="h4">Transfer ownership</Text>
        </div>
        <Text variant="body-sm" tone="secondary">
          Transferring this node needs Owner or Admin access in this workspace.
        </Text>
      </Card>
    );
  }

  return (
    <Card>
      <div className="mb-3 flex items-center gap-2">
        <ArrowRightLeft width={18} height={18} className="text-brand" aria-hidden />
        <Text variant="h4">Transfer ownership</Text>
        <Guidance for="server.transfer" />
      </div>
      <Text variant="body-sm" tone="secondary" className="mb-4">
        Hand this node, and everything on it, to another Operator account entirely: its project if
        it has one to itself, every service, installed plugins, history, and the credential.
        Nothing moves until they accept.
      </Text>

      {state.status === 'loading' ? <Loading label="Checking for a pending transfer" /> : null}

      {state.status === 'ready' && state.data ? (
        <div className="flex flex-col gap-3 rounded-md border border-border bg-subtle p-4">
          <Text variant="body-sm" className="text-ink">
            Offered to <span className="font-medium">{state.data.to_email}</span>, waiting on
            their decision.
          </Text>
          {state.data.message ? (
            <Text variant="body-sm" tone="secondary">
              &ldquo;{state.data.message}&rdquo;
            </Text>
          ) : null}
          {cancelError ? (
            <p role="alert" className="text-sm text-danger">
              {cancelError}
            </p>
          ) : null}
          <div>
            <Button
              size="sm"
              variant="secondary"
              disabled={canceling || refreshing}
              onClick={() => void cancel()}
            >
              {canceling ? 'Canceling' : 'Cancel transfer'}
            </Button>
          </div>
        </div>
      ) : null}

      {state.status === 'ready' && !state.data ? (
        <form className="flex flex-col gap-4" onSubmit={review} noValidate>
          <Field
            label="Their email"
            type="email"
            required
            autoComplete="off"
            placeholder="client@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <div className="flex flex-col gap-2">
            <label htmlFor="transfer-message" className="text-sm font-medium text-ink">
              Message (optional)
            </label>
            <textarea
              id="transfer-message"
              rows={3}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Here is your fully configured server."
              className="w-full resize-y rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            />
          </div>
          {formError ? (
            <p role="alert" className="text-sm text-danger">
              {formError}
            </p>
          ) : null}
          <div>
            <Button type="submit" variant="secondary" disabled={email.trim() === ''}>
              <ArrowRightLeft width={15} height={15} aria-hidden />
              Start transfer
            </Button>
          </div>
        </form>
      ) : null}

      {state.status === 'error' ? (
        <p role="alert" className="text-sm text-danger">
          {state.error.message}
        </p>
      ) : null}

      <ConfirmDialog
        open={reviewing}
        title="Transfer this node?"
        description={
          <>
            <span className="font-medium text-ink">{email}</span> will be offered this node and
            everything on it. You keep it until they accept; nothing changes yet.
          </>
        }
        confirmLabel="Send the offer"
        confirmVariant="primary"
        onConfirm={confirm}
        onCancel={() => setReviewing(false)}
      />
    </Card>
  );
}
