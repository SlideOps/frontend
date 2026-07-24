import { zodResolver } from '@hookform/resolvers/zod';
import {
  ApiError,
  createOperation,
  listNodeUsers,
  type ServerUser,
} from '@slideops/api-client';
import { Button, Card, Field, Text } from '@slideops/design-system';
import { CheckCircle2, Lock, Trash2, Users } from '@slideops/icons';
import { Guidance } from '@slideops/tooltips';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { useAsyncData } from '../hooks/useAsyncData';
import { ErrorNote, Loading } from './Feedback';
import { ConfirmDialog } from './ConfirmDialog';

const schema = z.object({
  username: z.string().trim().min(1, 'Enter a username.'),
  password: z.string().optional(),
  access: z.enum(['admin', 'limited']),
});

type FormValues = z.infer<typeof schema>;

function AccessBadge({ level }: { level: ServerUser['access_level'] }) {
  const isAdmin = level === 'admin';
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
        isAdmin ? 'bg-brand-subtle text-brand' : 'bg-subtle text-ink-muted'
      }`}
    >
      {isAdmin ? 'Administrator' : 'Limited'}
    </span>
  );
}

/**
 * The accounts on a server and their access level, with a form to create or
 * update an account and a guarded remove. Creating or removing an account runs
 * as a normal Operation the Operator approves; the account SlideOps connects
 * with is marked and can never be removed, so managing accounts never locks the
 * Operator out.
 */
export function ServerUsers({ nodeId }: { nodeId: string }) {
  const navigate = useNavigate();
  const { state } = useAsyncData((signal) => listNodeUsers(nodeId, signal), [nodeId]);

  const [pendingRemove, setPendingRemove] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { username: '', password: '', access: 'limited' },
  });

  const access = watch('access');

  const startManage = handleSubmit(async (values) => {
    setActionError(null);
    const password = values.password?.trim();
    try {
      const operation = await createOperation({
        node_id: nodeId,
        capability_key: 'manage-server-user',
        parameters: {
          username: values.username.trim(),
          sudo: values.access === 'admin',
          ...(password ? { password } : {}),
        },
      });
      reset({ username: '', password: '', access: 'limited' });
      navigate(`/app/operations/${operation.id}`);
    } catch (error) {
      setActionError(
        error instanceof ApiError ? error.message : 'That account could not be prepared. Try again.',
      );
    }
  });

  const runRemove = async () => {
    if (!pendingRemove) {
      return;
    }
    setActionError(null);
    try {
      const operation = await createOperation({
        node_id: nodeId,
        capability_key: 'remove-server-user',
        parameters: { username: pendingRemove },
      });
      setPendingRemove(null);
      navigate(`/app/operations/${operation.id}`);
    } catch (error) {
      setPendingRemove(null);
      setActionError(
        error instanceof ApiError ? error.message : 'That account could not be removed. Try again.',
      );
    }
  };

  return (
    <Card>
      <div className="mb-3 flex items-center gap-2">
        <Users width={18} height={18} className="text-brand" aria-hidden />
        <Text variant="h4">Server accounts</Text>
        <Guidance for="server.users" />
      </div>

      {state.status === 'loading' ? <Loading label="Reading the accounts on this server" /> : null}
      {state.status === 'error' ? <ErrorNote error={state.error} /> : null}
      {state.status === 'ready' ? (
        state.data.length > 0 ? (
          <ul className="divide-y divide-border">
            {state.data.map((user) => (
              <li key={user.username} className="flex items-center gap-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium text-ink">{user.username}</span>
                    {user.connection ? (
                      <span className="inline-flex items-center gap-1 text-xs text-success">
                        <Lock width={12} height={12} aria-hidden />
                        Connection account
                      </span>
                    ) : null}
                    {user.system ? (
                      <span className="text-xs text-ink-muted">System</span>
                    ) : null}
                  </div>
                </div>
                <AccessBadge level={user.access_level} />
                {user.connection || user.system ? (
                  <span className="w-9" aria-hidden />
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`Remove ${user.username}`}
                    onClick={() => setPendingRemove(user.username)}
                  >
                    <Trash2 width={15} height={15} aria-hidden />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <Text variant="body-sm" tone="secondary">
            No accounts read yet. Run the quick check, or create one below.
          </Text>
        )
      ) : null}

      <div className="mt-5 border-t border-border pt-5">
        <div className="mb-3 flex items-center gap-2">
          <Text variant="body-sm" className="font-medium">
            Create or update an account
          </Text>
          <Guidance for="server.users.create" />
        </div>
        <form className="flex flex-col gap-4" onSubmit={startManage} noValidate>
          <Field
            label="Username"
            placeholder="deploy"
            autoComplete="off"
            error={errors.username?.message}
            {...register('username')}
          />
          <Field
            label="Password (optional)"
            type="password"
            autoComplete="off"
            placeholder="Set or reset a password for this account"
            hint="Leave blank to leave the password unchanged. It is sealed and never shown again."
            error={errors.password?.message}
            {...register('password')}
          />
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-medium text-ink">Access level</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex cursor-pointer items-start gap-3 rounded-md border border-border p-3 text-sm has-[:checked]:border-brand has-[:checked]:bg-subtle">
                <input type="radio" value="limited" className="mt-0.5 accent-brand" {...register('access')} />
                <span>
                  <span className="font-medium text-ink">Limited</span>
                  <span className="mt-0.5 block text-ink-muted">A plain account with no sudo.</span>
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-3 rounded-md border border-border p-3 text-sm has-[:checked]:border-brand has-[:checked]:bg-subtle">
                <input type="radio" value="admin" className="mt-0.5 accent-brand" {...register('access')} />
                <span>
                  <span className="font-medium text-ink">Administrator</span>
                  <span className="mt-0.5 block text-ink-muted">Full sudo, can act as root.</span>
                </span>
              </label>
            </div>
          </fieldset>

          {actionError ? (
            <p role="alert" className="text-sm text-danger">
              {actionError}
            </p>
          ) : null}

          <div className="flex items-center gap-2">
            <Button type="submit" disabled={isSubmitting}>
              {access === 'admin' ? 'Prepare administrator' : 'Prepare account'}
              <CheckCircle2 width={15} height={15} aria-hidden />
            </Button>
            <Text variant="body-sm" tone="secondary">
              Opens an Operation you review and approve.
            </Text>
          </div>
        </form>
      </div>

      <ConfirmDialog
        open={pendingRemove !== null}
        title="Remove this account?"
        description={
          <>
            This prepares an Operation to remove{' '}
            <span className="font-medium text-ink">{pendingRemove}</span> and its home directory from
            the server. The connection account, root, and system accounts are protected and cannot be
            removed. You review and approve the Operation before it runs.
          </>
        }
        confirmLabel="Prepare removal"
        confirmVariant="danger"
        onConfirm={runRemove}
        onCancel={() => setPendingRemove(null)}
      />
    </Card>
  );
}
