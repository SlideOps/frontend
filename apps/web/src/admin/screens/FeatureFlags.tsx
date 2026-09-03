import {
  ApiError,
  createFeatureFlag,
  deleteFeatureFlag,
  listFeatureFlags,
  setFeatureFlagEnabled,
  type FeatureFlag,
} from '@slideops/api-client';
import { Button, Field, Text } from '@slideops/design-system';
import { Flag, Plus, ToggleLeft, ToggleRight, Trash2 } from '@slideops/icons';
import { EmptyState, PageHeader } from '@slideops/ui';
import { useState } from 'react';
import { AdminShell } from '../components/AdminShell';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { ErrorNote, Loading } from '../components/Feedback';
import { TBody, TD, TH, THead, TR, Table } from '../components/Table';
import { useAsyncData } from '../hooks/useAsyncData';

/*
 * Centralized feature flags: a deliberate rollout or an internal/admin-only
 * gate, distinct from the Emergency screen's stop switches. A flag is reached
 * for on an Admin's own timeline, not mid-incident, so this screen has no
 * "hold" language and no audit-trail warnings on every toggle -- flipping a
 * flag is an ordinary, expected action here.
 */

const keyPattern = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function when(value: string): string {
  return new Date(value).toLocaleString();
}

export function FeatureFlags() {
  const { state, reload } = useAsyncData((signal) => listFeatureFlags(signal), []);

  const [actionError, setActionError] = useState<string | null>(null);

  const [creating, setCreating] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);

  const [deleting, setDeleting] = useState<FeatureFlag | null>(null);

  const keyIsValid = newKey === '' || keyPattern.test(newKey);

  const resetCreateForm = () => {
    setNewKey('');
    setNewTitle('');
    setNewDescription('');
    setCreateError(null);
  };

  const runToggle = async (flag: FeatureFlag) => {
    setActionError(null);
    try {
      await setFeatureFlagEnabled(flag.key, !flag.enabled);
      reload();
    } catch (error) {
      setActionError(
        error instanceof ApiError ? error.message : 'That toggle did not go through. Try again.',
      );
    }
  };

  const runCreate = async () => {
    setCreateError(null);
    if (!newKey.trim() || !newTitle.trim()) {
      setCreateError('A key and a title are both required.');
      return;
    }
    if (!keyPattern.test(newKey)) {
      setCreateError('The key may only use lowercase letters, digits, and hyphens.');
      return;
    }
    try {
      await createFeatureFlag({ key: newKey.trim(), title: newTitle.trim(), description: newDescription.trim() });
      setCreating(false);
      resetCreateForm();
      reload();
    } catch (error) {
      setCreateError(
        error instanceof ApiError ? error.message : 'That flag did not get created. Try again.',
      );
    }
  };

  const runDelete = async () => {
    if (!deleting) {
      return;
    }
    setActionError(null);
    try {
      await deleteFeatureFlag(deleting.key);
      setDeleting(null);
      reload();
    } catch (error) {
      setActionError(
        error instanceof ApiError ? error.message : 'That delete did not go through. Try again.',
      );
      setDeleting(null);
    }
  };

  const flags = state.status === 'ready' ? state.data : [];

  return (
    <AdminShell active="feature-flags">
      <PageHeader
        title="Feature flags"
        description="A deliberate rollout or an internal/admin-only gate you control on your own timeline. For a mid-incident stop switch, use Emergency instead."
        actions={
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              resetCreateForm();
              setCreating(true);
            }}
          >
            <Plus width={15} height={15} aria-hidden />
            New flag
          </Button>
        }
      />

      {state.status === 'loading' ? <Loading label="Loading feature flags" /> : null}
      {state.status === 'error' ? <ErrorNote error={state.error} /> : null}
      {actionError ? (
        <p role="alert" className="mb-4 text-sm text-danger">
          {actionError}
        </p>
      ) : null}

      {state.status === 'ready' ? (
        flags.length === 0 ? (
          <EmptyState
            icon={Flag}
            title="No feature flags yet"
            description="Create one to gate a feature behind a runtime toggle instead of an environment variable or a hardcoded conditional."
          />
        ) : (
          <Table label="Feature flags">
            <THead>
              <TH>Flag</TH>
              <TH>Status</TH>
              <TH>Updated</TH>
              <TH className="text-right">Actions</TH>
            </THead>
            <TBody>
              {flags.map((flag) => (
                <TR key={flag.key}>
                  <TD>
                    <Text variant="body-sm" className="font-medium">
                      {flag.title}
                    </Text>
                    <Text variant="caption" tone="secondary" className="block font-mono">
                      {flag.key}
                    </Text>
                    {flag.description ? (
                      <Text variant="caption" tone="secondary" className="mt-1 block max-w-md">
                        {flag.description}
                      </Text>
                    ) : null}
                  </TD>
                  <TD>
                    <span className={flag.enabled ? 'font-medium text-success' : 'text-ink-muted'}>
                      {flag.enabled ? 'On' : 'Off'}
                    </span>
                  </TD>
                  <TD className="text-ink-muted">{when(flag.updated_at)}</TD>
                  <TD className="text-right">
                    <div className="flex justify-end gap-1.5">
                      <Button variant="ghost" size="sm" onClick={() => runToggle(flag)}>
                        {flag.enabled ? (
                          <ToggleRight width={16} height={16} aria-hidden />
                        ) : (
                          <ToggleLeft width={16} height={16} aria-hidden />
                        )}
                        {flag.enabled ? 'Turn off' : 'Turn on'}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setDeleting(flag)}>
                        <Trash2 width={14} height={14} aria-hidden />
                        Delete
                      </Button>
                    </div>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )
      ) : null}

      <ConfirmDialog
        open={creating}
        title="Create a feature flag?"
        description={
          <div className="flex flex-col gap-3">
            <Field
              label="Key"
              hint="Lowercase letters, digits, and hyphens only, e.g. new-billing-flow. Never renamed once real code depends on it."
              value={newKey}
              onChange={(event) => setNewKey(event.target.value)}
              error={!keyIsValid ? 'Only lowercase letters, digits, and hyphens.' : undefined}
              placeholder="new-billing-flow"
            />
            <Field
              label="Title"
              value={newTitle}
              onChange={(event) => setNewTitle(event.target.value)}
              placeholder="New billing flow"
            />
            <Field
              label="Description"
              hint="Optional. What this flag gates, for whoever reads it next."
              value={newDescription}
              onChange={(event) => setNewDescription(event.target.value)}
            />
            {createError ? (
              <p role="alert" className="text-sm text-danger">
                {createError}
              </p>
            ) : null}
          </div>
        }
        confirmLabel="Create flag"
        confirmVariant="primary"
        onConfirm={runCreate}
        onCancel={() => {
          setCreating(false);
          resetCreateForm();
        }}
      />

      <ConfirmDialog
        open={deleting !== null}
        title="Delete this feature flag?"
        description={
          <>
            Removes <strong className="text-ink">{deleting?.title}</strong> (
            <span className="font-mono">{deleting?.key}</span>) entirely. Any code still reading
            this key will see it as disabled from then on.
          </>
        }
        confirmLabel="Delete flag"
        confirmVariant="danger"
        onConfirm={runDelete}
        onCancel={() => setDeleting(null)}
      />
    </AdminShell>
  );
}
