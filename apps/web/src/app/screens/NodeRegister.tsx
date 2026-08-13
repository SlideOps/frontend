import { zodResolver } from '@hookform/resolvers/zod';
import { ApiError, createNode, importSSHKey, listProjects, listSSHKeys } from '@slideops/api-client';
import { Button, Card, Field, Text } from '@slideops/design-system';
import { Guidance } from '@slideops/tooltips';
import { PageHeader } from '@slideops/ui';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { useAsyncData } from '../hooks/useAsyncData';
import { nodeSchema, type NodeFormValues } from '../node-schema';
import { OperatorShell } from '../components/OperatorShell';
import { TagInput } from '../components/TagInput';

const inputClass =
  'w-full rounded-md border border-border bg-surface px-3 text-sm text-ink placeholder:text-ink-muted transition-colors duration-fast ease-standard focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus';

/** Register a Node: connection details plus the credential, stored encrypted. */
export function NodeRegister() {
  const navigate = useNavigate();
  const [formError, setFormError] = useState<string | null>(null);
  const [saveKey, setSaveKey] = useState(false);
  const projects = useAsyncData((signal) => listProjects(signal), []);
  const sshKeys = useAsyncData((signal) => listSSHKeys(signal), []);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<NodeFormValues>({
    resolver: zodResolver(nodeSchema),
    defaultValues: { port: 22, auth_kind: 'private_key', credential_source: 'paste', tags: [] },
  });

  const authKind = watch('auth_kind');
  const credentialSource = watch('credential_source');
  const tags = watch('tags') ?? [];

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      // Pasting a private key with "save to library" checked imports it first,
      // then registers the Node against the saved key rather than the raw
      // paste, so the Node ends up on the exact same path a pre-saved key
      // would have taken -- one credential story, not two.
      let sshKeyId = values.ssh_key_id;
      if (values.credential_source === 'paste' && values.auth_kind === 'private_key' && saveKey) {
        const name = values.save_key_as?.trim();
        if (name && values.secret) {
          const saved = await importSSHKey({ name, private_key: values.secret });
          sshKeyId = saved.id;
        }
      }

      const node = await createNode({
        name: values.name,
        hostname: values.hostname ?? '',
        address: values.address,
        port: values.port,
        ssh_username: values.ssh_username,
        project_id: values.project_id ? values.project_id : undefined,
        tags: values.tags,
        ...(sshKeyId
          ? { ssh_key_id: sshKeyId }
          : { auth: { kind: values.auth_kind, secret: values.secret ?? '' } }),
      });
      navigate(`/app/nodes/${node.id}`, { replace: true });
    } catch (error) {
      setFormError(
        error instanceof ApiError ? error.message : 'The Node could not be saved. Try again.',
      );
    }
  });

  const savedKeys = sshKeys.state.status === 'ready' ? sshKeys.state.data : [];

  return (
    <OperatorShell active="nodes">
      <PageHeader
        title="Connect a Node"
        description="A Node is one Linux machine SlideOps reaches over SSH. It reads the Node during Discovery and never changes anything without a plan you approve."
      />

      <Card className="max-w-2xl">
        <form className="flex flex-col gap-5" onSubmit={onSubmit} noValidate>
          <Field
            label="Name"
            placeholder="web-1"
            error={errors.name?.message}
            labelAdornment={<Guidance for="node.name" />}
            {...register('name')}
          />
          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              label="Hostname (optional)"
              placeholder="A label, for example contabo-vps"
              hint="Just a label for your reference. Leave it blank if you like."
              error={errors.hostname?.message}
              labelAdornment={<Guidance for="node.hostname" />}
              {...register('hostname')}
            />
            <Field
              label="Address"
              placeholder="203.0.113.10"
              hint="The IP or domain SlideOps connects to over SSH."
              error={errors.address?.message}
              labelAdornment={<Guidance for="node.address" />}
              {...register('address')}
            />
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              label="SSH port"
              type="number"
              inputMode="numeric"
              placeholder="22"
              error={errors.port?.message}
              labelAdornment={<Guidance for="node.port" />}
              {...register('port')}
            />
            <Field
              label="SSH username"
              placeholder="deploy"
              autoComplete="off"
              error={errors.ssh_username?.message}
              labelAdornment={<Guidance for="node.username" />}
              {...register('ssh_username')}
            />
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <label htmlFor="project_id" className="text-sm font-medium text-ink">
                  Project (optional)
                </label>
                <Guidance for="node.project" />
              </div>
              <select
                id="project_id"
                className={`h-10 ${inputClass}`}
                defaultValue=""
                {...register('project_id')}
              >
                <option value="">No Project</option>
                {projects.state.status === 'ready'
                  ? projects.state.data.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                    ))
                  : null}
              </select>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-ink">Tags (optional)</span>
                <Guidance for="node.tags" />
              </div>
              <TagInput value={tags} onChange={(next) => setValue('tags', next)} />
            </div>
          </div>

          <fieldset className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <legend className="text-sm font-medium text-ink">Credential</legend>
              <Guidance for="node.credentialSource" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex cursor-pointer items-start gap-3 rounded-md border border-border p-3 text-sm has-[:checked]:border-brand has-[:checked]:bg-subtle">
                <input
                  type="radio"
                  value="paste"
                  className="mt-0.5 accent-brand"
                  {...register('credential_source')}
                />
                <span>
                  <span className="font-medium text-ink">Paste a credential</span>
                  <span className="mt-0.5 block text-ink-muted">
                    A private key or a password, stored encrypted.
                  </span>
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
                  <span className="mt-0.5 block text-ink-muted">
                    {savedKeys.length === 0
                      ? 'No keys saved yet.'
                      : 'Pick a key already in your library.'}
                  </span>
                </span>
              </label>
            </div>
          </fieldset>

          {credentialSource === 'saved_key' ? (
            <div className="flex flex-col gap-2">
              <label htmlFor="ssh_key_id" className="text-sm font-medium text-ink">
                Saved key
              </label>
              <select
                id="ssh_key_id"
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
                <legend className="text-sm font-medium text-ink">How to sign in</legend>
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
                        Password sign in stays on so you are never locked out.
                      </span>
                    </span>
                  </label>
                </div>
              </fieldset>

              {authKind === 'private_key' ? (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-2">
                    <label htmlFor="secret" className="text-sm font-medium text-ink">
                      Private key
                    </label>
                    <Guidance for="node.secret" />
                  </div>
                  <textarea
                    id="secret"
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

                  <label className="mt-1 flex cursor-pointer items-center gap-2 text-sm text-ink">
                    <input
                      type="checkbox"
                      className="accent-brand"
                      checked={saveKey}
                      onChange={(event) => setSaveKey(event.target.checked)}
                    />
                    Save this key to your library, so it can be picked for another Node
                  </label>
                  {saveKey ? (
                    <Field
                      label="Key name"
                      placeholder="prod-deploy"
                      error={errors.save_key_as?.message}
                      {...register('save_key_as')}
                    />
                  ) : null}
                </div>
              ) : (
                <Field
                  label="Password"
                  type="password"
                  autoComplete="off"
                  placeholder="The SSH password for this account"
                  hint="Stored encrypted the moment it arrives. It is never shown again."
                  error={errors.secret?.message}
                  labelAdornment={<Guidance for="node.secret" />}
                  {...register('secret')}
                />
              )}
            </>
          )}

          {formError ? (
            <p role="alert" className="text-sm text-danger">
              {formError}
            </p>
          ) : null}

          <div className="flex items-center gap-3">
            <Button type="submit" size="lg" disabled={isSubmitting}>
              {isSubmitting ? 'Saving' : 'Connect Node'}
            </Button>
            <Button type="button" variant="ghost" size="lg" onClick={() => navigate('/app/nodes')}>
              Cancel
            </Button>
          </div>
        </form>
      </Card>
    </OperatorShell>
  );
}
