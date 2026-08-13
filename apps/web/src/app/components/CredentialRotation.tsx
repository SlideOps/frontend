import { zodResolver } from '@hookform/resolvers/zod';
import {
  ApiError,
  listSSHKeys,
  rotateNodeCredential,
  type Node,
  type RotateCredentialInput,
} from '@slideops/api-client';
import { Button, Card, Field, Text } from '@slideops/design-system';
import { CheckCircle2, KeyRound } from '@slideops/icons';
import { Guidance } from '@slideops/tooltips';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useAsyncData } from '../hooks/useAsyncData';
import { ConfirmDialog } from './ConfirmDialog';

const inputClass =
  'w-full rounded-md border border-border bg-surface px-3 text-sm text-ink placeholder:text-ink-muted transition-colors duration-fast ease-standard focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus';

const schema = z
  .object({
    username: z.string().trim().optional(),
    credential_source: z.enum(['paste', 'saved_key']),
    auth_kind: z.enum(['password', 'private_key']),
    secret: z.string().optional(),
    ssh_key_id: z.string().optional(),
  })
  .superRefine((values, ctx) => {
    if (values.credential_source === 'saved_key') {
      if (!values.ssh_key_id) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['ssh_key_id'],
          message: 'Choose a saved key.',
        });
      }
      return;
    }
    if (!values.secret) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['secret'],
        message: 'Enter the new password or private key.',
      });
    }
  });

type FormValues = z.infer<typeof schema>;

/**
 * Change the stored connection credential for a server, optionally moving the
 * connection to a different account. The switch is confirmed first, and the
 * backend verifies the new credential can sign in before it applies, so a wrong
 * credential changes nothing and the Operator is never locked out.
 */
export function CredentialRotation({
  node,
  onRotated,
}: {
  node: Node;
  onRotated: (updated: Node) => void;
}) {
  const [pending, setPending] = useState<RotateCredentialInput | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const sshKeys = useAsyncData((signal) => listSSHKeys(signal), []);
  const savedKeys = sshKeys.state.status === 'ready' ? sshKeys.state.data : [];

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      username: '',
      credential_source: 'paste',
      auth_kind: node.auth_kind,
      secret: '',
    },
  });

  const authKind = watch('auth_kind');
  const credentialSource = watch('credential_source');

  const review = handleSubmit((values) => {
    setFormError(null);
    setDone(null);
    const username = values.username?.trim();
    setPending({
      username: username ? username : undefined,
      ...(values.credential_source === 'saved_key'
        ? { ssh_key_id: values.ssh_key_id }
        : { auth_kind: values.auth_kind, secret: values.secret }),
    });
  });

  const apply = async () => {
    if (!pending) {
      return;
    }
    setFormError(null);
    try {
      const updated = await rotateNodeCredential(node.id, pending);
      setPending(null);
      setDone(`SlideOps now signs in as ${updated.ssh_username}.`);
      reset({ username: '', credential_source: 'paste', auth_kind: updated.auth_kind, secret: '' });
      onRotated(updated);
    } catch (error) {
      setPending(null);
      if (error instanceof ApiError && error.code === 'credential_verification_failed') {
        setFormError(
          'That credential could not sign in, so nothing was changed. The current credential still works. Check the account and secret, then try again.',
        );
      } else {
        setFormError(
          error instanceof ApiError
            ? error.message
            : 'The credential could not be changed. Try again.',
        );
      }
    }
  };

  return (
    <Card>
      <div className="mb-3 flex items-center gap-2">
        <KeyRound width={18} height={18} className="text-brand" aria-hidden />
        <Text variant="h4">Change connection credential</Text>
        <Guidance for="server.credential" />
      </div>
      <Text variant="body-sm" tone="secondary" className="mb-4">
        SlideOps signs in as <span className="font-medium text-ink">{node.ssh_username}</span> with
        a {node.auth_kind === 'private_key' ? 'private key' : 'password'}. It verifies the new
        credential can sign in before switching, so a wrong one changes nothing and you are never
        locked out.
      </Text>

      <form className="flex flex-col gap-5" onSubmit={review} noValidate>
        <Field
          label="Connection username (optional)"
          placeholder={node.ssh_username}
          autoComplete="off"
          error={errors.username?.message}
          labelAdornment={<Guidance for="server.credential.username" />}
          {...register('username')}
        />

        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-medium text-ink">Credential</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex cursor-pointer items-start gap-3 rounded-md border border-border p-3 text-sm has-[:checked]:border-brand has-[:checked]:bg-subtle">
              <input
                type="radio"
                value="paste"
                className="mt-0.5 accent-brand"
                {...register('credential_source')}
              />
              <span>
                <span className="font-medium text-ink">Paste a new credential</span>
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-3 rounded-md border border-border p-3 text-sm has-[:checked]:border-brand has-[:checked]:bg-subtle">
              <input
                type="radio"
                value="saved_key"
                className="mt-0.5 accent-brand"
                disabled={savedKeys.length === 0}
                {...register('credential_source')}
              />
              <span>
                <span className="font-medium text-ink">Use a saved key</span>
                {savedKeys.length === 0 ? (
                  <span className="mt-0.5 block text-ink-muted">No keys saved yet.</span>
                ) : null}
              </span>
            </label>
          </div>
        </fieldset>

        {credentialSource === 'saved_key' ? (
          <div className="flex flex-col gap-2">
            <label htmlFor="rotate-ssh-key" className="text-sm font-medium text-ink">
              Saved key
            </label>
            <select
              id="rotate-ssh-key"
              className={`h-10 ${inputClass}`}
              defaultValue=""
              {...register('ssh_key_id')}
            >
              <option value="" disabled>
                Choose a key
              </option>
              {savedKeys.map((key) => (
                <option key={key.id} value={key.id}>
                  {key.name} ({key.fingerprint})
                </option>
              ))}
            </select>
            {errors.ssh_key_id ? (
              <p className="text-sm text-danger">{errors.ssh_key_id.message}</p>
            ) : null}
          </div>
        ) : (
          <>
            <fieldset className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <legend className="text-sm font-medium text-ink">How to sign in</legend>
                <Guidance for="server.credential.authKind" />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex cursor-pointer items-start gap-3 rounded-md border border-border p-3 text-sm has-[:checked]:border-brand has-[:checked]:bg-subtle">
                  <input
                    type="radio"
                    value="private_key"
                    className="mt-0.5 accent-brand"
                    {...register('auth_kind')}
                  />
                  <span>
                    <span className="font-medium text-ink">Private key</span>
                    <span className="mt-0.5 block text-ink-muted">
                      Recommended. Stronger and never locks you out during hardening.
                    </span>
                  </span>
                </label>
                <label className="flex cursor-pointer items-start gap-3 rounded-md border border-border p-3 text-sm has-[:checked]:border-brand has-[:checked]:bg-subtle">
                  <input
                    type="radio"
                    value="password"
                    className="mt-0.5 accent-brand"
                    {...register('auth_kind')}
                  />
                  <span>
                    <span className="font-medium text-ink">Password</span>
                    <span className="mt-0.5 block text-ink-muted">
                      A password the account can sign in with.
                    </span>
                  </span>
                </label>
              </div>
            </fieldset>

            {authKind === 'private_key' ? (
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                  <label htmlFor="rotate-secret" className="text-sm font-medium text-ink">
                    New private key
                  </label>
                  <Guidance for="server.credential.secret" />
                </div>
                <textarea
                  id="rotate-secret"
                  rows={6}
                  spellCheck={false}
                  autoComplete="off"
                  placeholder="-----BEGIN OPENSSH PRIVATE KEY-----"
                  className={`resize-y py-2 font-mono ${inputClass} ${errors.secret ? 'border-danger' : ''}`}
                  aria-invalid={errors.secret ? true : undefined}
                  {...register('secret')}
                />
                <Text variant="body-sm" tone="secondary">
                  Stored encrypted the moment it arrives. It is never shown again.
                </Text>
                {errors.secret ? (
                  <p className="text-sm text-danger">{errors.secret.message}</p>
                ) : null}
              </div>
            ) : (
              <Field
                label="New password"
                type="password"
                autoComplete="off"
                placeholder="The SSH password for this account"
                hint="Stored encrypted the moment it arrives. It is never shown again."
                error={errors.secret?.message}
                labelAdornment={<Guidance for="server.credential.secret" />}
                {...register('secret')}
              />
            )}
          </>
        )}

        {done ? (
          <p role="status" className="flex items-center gap-2 text-sm text-success">
            <CheckCircle2 width={16} height={16} aria-hidden />
            {done}
          </p>
        ) : null}
        {formError ? (
          <p role="alert" className="text-sm text-danger">
            {formError}
          </p>
        ) : null}

        <div>
          <Button type="submit">
            <KeyRound width={15} height={15} aria-hidden />
            Change credential
          </Button>
        </div>
      </form>

      <ConfirmDialog
        open={pending !== null}
        title="Change the connection credential?"
        description={
          <>
            SlideOps will sign in with the new credential
            {pending?.username ? (
              <>
                {' '}
                as <span className="font-medium text-ink">{pending.username}</span>
              </>
            ) : null}{' '}
            and only switch the stored credential if that sign in succeeds. If it cannot sign in,
            nothing changes and the current credential keeps working, so you are never locked out.
          </>
        }
        confirmLabel="Verify and switch"
        confirmVariant="primary"
        onConfirm={apply}
        onCancel={() => setPending(null)}
      />
    </Card>
  );
}
