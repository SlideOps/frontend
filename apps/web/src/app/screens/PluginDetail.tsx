import {
  getMarketplacePlugin,
  installPlugin,
  listCapabilities,
  listInstalledPlugins,
  uninstallPlugin,
  updatePlugin,
  type Capability,
  type InstalledPlugin,
  type Plugin,
} from '@slideops/api-client';
import { Button, Card, Text } from '@slideops/design-system';
import {
  ArrowLeft,
  ArrowRight,
  Boxes,
  Check,
  Lock,
  Play,
  ShieldCheck,
  Trash2,
} from '@slideops/icons';
import { Guidance } from '@slideops/tooltips';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ErrorNote, Loading } from '../components/Feedback';
import { OperatorShell } from '../components/OperatorShell';
import { PluginConfigForm } from '../components/PluginConfigForm';
import { useAsyncData } from '../hooks/useAsyncData';

interface PluginView {
  plugin: Plugin;
  installedRecord?: InstalledPlugin;
  capabilities: Capability[];
}

function Section({
  title,
  guidanceKey,
  children,
}: {
  title: string;
  guidanceKey?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <Text variant="caption" tone="secondary">
          {title}
        </Text>
        {guidanceKey ? <Guidance for={guidanceKey} size={14} /> : null}
      </div>
      {children}
    </div>
  );
}

/**
 * The Plugin detail: its manifest, the Capabilities it adds, the permissions it
 * asks for, and the install action. When the Plugin needs config, the install
 * and reconfigure forms are generated from its config schema, reusing the same
 * fields and validation a Capability's inputs use. An installed Plugin can be
 * reconfigured, enabled or disabled, and uninstalled, and its Capabilities link
 * straight to where they run. The Core bundle shows as built in and stays.
 */
export function PluginDetail() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirmUninstall, setConfirmUninstall] = useState(false);

  const result = useAsyncData<PluginView>(async (signal) => {
    const [plugin, installed, capabilities] = await Promise.all([
      getMarketplacePlugin(id, signal),
      listInstalledPlugins(signal),
      listCapabilities(undefined, signal),
    ]);
    return {
      plugin,
      installedRecord: installed.find((p) => p.plugin_id === plugin.id),
      capabilities,
    };
  }, [id]);

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setActionError(null);
    try {
      await action();
      result.reload();
    } catch (cause) {
      setActionError(
        cause instanceof Error ? cause.message : 'That action could not be completed.',
      );
    } finally {
      setBusy(false);
      setConfirmUninstall(false);
    }
  }

  return (
    <OperatorShell active="marketplace">
      <button
        type="button"
        onClick={() => navigate('/app/marketplace')}
        className="mb-4 inline-flex items-center gap-1 text-sm text-ink-muted transition-colors duration-fast ease-standard hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
      >
        <ArrowLeft width={16} height={16} aria-hidden />
        All Plugins
      </button>

      {result.state.status === 'loading' ? <Loading label="Loading this Plugin" /> : null}
      {result.state.status === 'error' ? <ErrorNote error={result.state.error} /> : null}
      {result.state.status === 'ready'
        ? (() => {
            const { plugin, installedRecord, capabilities } = result.state.data;
            const installed = plugin.installed || Boolean(installedRecord);
            const isCore = Boolean(plugin.is_core || installedRecord?.is_core);
            const enabled = installedRecord ? installedRecord.enabled : true;
            const byKey = new Map(capabilities.map((c) => [c.key, c]));

            return (
              <>
                <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-subtle text-brand">
                      <Boxes width={22} height={22} aria-hidden />
                    </span>
                    <div className="min-w-0">
                      <Text variant="h1">{plugin.name}</Text>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <Text variant="caption" tone="secondary">
                          {plugin.category} · v{plugin.version} · {plugin.author}
                        </Text>
                      </div>
                    </div>
                  </div>
                  {installed ? (
                    <span className="inline-flex items-center gap-1.5 rounded-pill bg-subtle px-3 py-1 text-xs font-medium text-success">
                      {isCore ? (
                        <ShieldCheck width={13} height={13} aria-hidden />
                      ) : (
                        <Check width={13} height={13} aria-hidden />
                      )}
                      {isCore ? 'Built in' : enabled ? 'Installed' : 'Installed, disabled'}
                    </span>
                  ) : null}
                </div>

                <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
                  <div className="flex flex-col gap-6">
                    <Card className="flex flex-col gap-5">
                      <Section title="What it does" guidanceKey="marketplace.manifest">
                        <Text variant="body" tone="secondary">
                          {plugin.description}
                        </Text>
                      </Section>

                      {plugin.provides && plugin.provides.length > 0 ? (
                        <Section title="Capabilities it adds" guidanceKey="marketplace.provides">
                          <div className="flex flex-col gap-2">
                            {plugin.provides.map((key) => {
                              const capability = byKey.get(key);
                              const available = installed && enabled && capability;
                              return (
                                <div
                                  key={key}
                                  className="flex items-center justify-between gap-3 rounded-md border border-border bg-surface px-3 py-2"
                                >
                                  <div className="min-w-0">
                                    <Text variant="body-sm" className="font-medium">
                                      {capability?.name ?? key}
                                    </Text>
                                    {capability?.description ? (
                                      <Text variant="caption" tone="secondary" className="block">
                                        {capability.description}
                                      </Text>
                                    ) : null}
                                  </div>
                                  {available ? (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="shrink-0 px-2"
                                      onClick={() => navigate(`/app/capabilities/${key}`)}
                                    >
                                      <Play width={14} height={14} aria-hidden />
                                      Run
                                    </Button>
                                  ) : null}
                                </div>
                              );
                            })}
                          </div>
                        </Section>
                      ) : null}

                      {plugin.permissions && plugin.permissions.length > 0 ? (
                        <Section title="Permissions" guidanceKey="marketplace.permissions">
                          <ul className="flex flex-col gap-2">
                            {plugin.permissions.map((permission) => (
                              <li key={permission} className="flex items-start gap-2">
                                <Lock
                                  width={14}
                                  height={14}
                                  className="mt-0.5 shrink-0 text-ink-muted"
                                  aria-hidden
                                />
                                <Text variant="body-sm" tone="secondary">
                                  {permission}
                                </Text>
                              </li>
                            ))}
                          </ul>
                        </Section>
                      ) : null}
                    </Card>
                  </div>

                  <Card className="h-fit flex-col gap-4">
                    <div className="mb-2 flex items-center gap-2">
                      <Boxes width={18} height={18} className="text-brand" aria-hidden />
                      <Text variant="h4">
                        {installed ? 'Manage this Plugin' : 'Install this Plugin'}
                      </Text>
                      <Guidance for="marketplace.install" />
                    </div>

                    {!installed ? (
                      <PluginConfigForm
                        config={plugin.config ?? []}
                        submitLabel="Install"
                        pendingLabel="Installing"
                        note={
                          plugin.config && plugin.config.length > 0
                            ? 'These settings configure the Plugin when it installs.'
                            : 'This unlocks its Capabilities for you.'
                        }
                        onSubmit={(config) =>
                          run(async () => {
                            await installPlugin({
                              plugin_id: plugin.id,
                              config: Object.keys(config).length > 0 ? config : undefined,
                            });
                          })
                        }
                      />
                    ) : (
                      <div className="flex flex-col gap-5">
                        {isCore ? (
                          <div className="flex items-start gap-3 rounded-md border border-border bg-subtle p-3">
                            <ShieldCheck
                              width={16}
                              height={16}
                              className="mt-0.5 shrink-0 text-brand"
                              aria-hidden
                            />
                            <Text variant="body-sm" tone="secondary">
                              The Core bundle is pre-installed and always available. It cannot be
                              disabled or uninstalled.
                            </Text>
                          </div>
                        ) : (
                          <>
                            {plugin.config && plugin.config.length > 0 ? (
                              <Section title="Reconfigure" guidanceKey="marketplace.reconfigure">
                                <PluginConfigForm
                                  config={plugin.config}
                                  submitLabel="Save configuration"
                                  pendingLabel="Saving"
                                  onSubmit={(config) =>
                                    run(async () => {
                                      await updatePlugin(plugin.id, { config });
                                    })
                                  }
                                />
                              </Section>
                            ) : null}

                            <div className="flex flex-wrap items-center gap-3">
                              <Button
                                variant="secondary"
                                disabled={busy}
                                onClick={() =>
                                  run(async () => {
                                    await updatePlugin(plugin.id, { enabled: !enabled });
                                  })
                                }
                              >
                                {enabled ? 'Disable' : 'Enable'}
                              </Button>
                              <Guidance for="marketplace.enabled" />
                            </div>

                            {confirmUninstall ? (
                              <div className="flex flex-col gap-3 rounded-md border border-border bg-subtle p-3">
                                <Text variant="body-sm" tone="secondary">
                                  Uninstall {plugin.name}? Its Capabilities become unavailable to
                                  you until you install it again.
                                </Text>
                                <div className="flex flex-wrap gap-2">
                                  <Button
                                    variant="danger"
                                    disabled={busy}
                                    onClick={() =>
                                      run(async () => {
                                        await uninstallPlugin(plugin.id);
                                      })
                                    }
                                  >
                                    <Trash2 width={15} height={15} aria-hidden />
                                    {busy ? 'Uninstalling' : 'Confirm uninstall'}
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    disabled={busy}
                                    onClick={() => setConfirmUninstall(false)}
                                  >
                                    Keep it
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <Button
                                variant="ghost"
                                className="self-start px-0 text-danger"
                                disabled={busy}
                                onClick={() => setConfirmUninstall(true)}
                              >
                                <Trash2 width={15} height={15} aria-hidden />
                                Uninstall
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    )}

                    {actionError ? (
                      <p role="alert" className="text-sm text-danger">
                        {actionError}
                      </p>
                    ) : null}

                    {installed && enabled && !isCore ? (
                      <button
                        type="button"
                        onClick={() => navigate('/app/capabilities')}
                        className="inline-flex items-center gap-1 self-start text-sm font-medium text-brand transition-colors duration-fast ease-standard hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                      >
                        See it in the Capability catalog
                        <ArrowRight width={15} height={15} aria-hidden />
                      </button>
                    ) : null}
                  </Card>
                </div>
              </>
            );
          })()
        : null}
    </OperatorShell>
  );
}
