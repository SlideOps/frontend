import {
  getMarketplacePlugin,
  listCapabilities,
  type Capability,
  type Plugin,
} from '@slideops/api-client';
import { Button, Card, Text } from '@slideops/design-system';
import { ArrowLeft, ArrowRight, Boxes, capabilityIcon, Lock, ShieldCheck } from '@slideops/icons';
import { Guidance } from '@slideops/tooltips';
import type { ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ErrorNote, Loading } from '../components/Feedback';
import { OperatorShell } from '../components/OperatorShell';
import { useAsyncData } from '../hooks/useAsyncData';

interface PluginView {
  plugin: Plugin;
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
 * The Plugin detail as a browse-only catalog entry: its manifest, the
 * Capabilities it adds, and the permissions it asks for. Plugins are installed
 * per Project, so this global view does not install anything; it points the
 * Operator to open a Project to install and configure the Plugin there. The Core
 * bundle shows as built in and always available.
 */
export function PluginDetail() {
  const { id = '' } = useParams();
  const navigate = useNavigate();

  const result = useAsyncData<PluginView>(
    async (signal) => {
      // No Project here: the catalog is global, so only Core reads as installed and
      // the Capability lookup resolves the Core security Capabilities by name.
      const [plugin, capabilities] = await Promise.all([
        getMarketplacePlugin(id, undefined, signal),
        listCapabilities({}, signal),
      ]);
      return { plugin, capabilities };
    },
    [id],
  );

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
            const { plugin, capabilities } = result.state.data;
            const isCore = Boolean(plugin.is_core);
            const byKey = new Map(capabilities.map((c) => [c.key, c]));
            const PluginIcon = plugin.provides[0]
              ? capabilityIcon({ key: plugin.provides[0], category: plugin.category })
              : Boxes;

            return (
              <>
                <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-subtle text-brand">
                      <PluginIcon width={22} height={22} aria-hidden />
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
                  {isCore ? (
                    <span className="inline-flex items-center gap-1.5 rounded-pill bg-subtle px-3 py-1 text-xs font-medium text-success">
                      <ShieldCheck width={13} height={13} aria-hidden />
                      Built in
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
                              return (
                                <div
                                  key={key}
                                  className="rounded-md border border-border bg-surface px-3 py-2"
                                >
                                  <Text variant="body-sm" className="font-medium">
                                    {capability?.name ?? key}
                                  </Text>
                                  {capability?.description ? (
                                    <Text variant="caption" tone="secondary" className="block">
                                      {capability.description}
                                    </Text>
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
                      <Text variant="h4">{isCore ? 'Built in' : 'Install this Plugin'}</Text>
                      <Guidance for="marketplace.install" />
                    </div>

                    {isCore ? (
                      <div className="flex items-start gap-3 rounded-md border border-border bg-subtle p-3">
                        <ShieldCheck
                          width={16}
                          height={16}
                          className="mt-0.5 shrink-0 text-brand"
                          aria-hidden
                        />
                        <Text variant="body-sm" tone="secondary">
                          The Core security bundle is pre-installed on every server and always
                          available. It cannot be disabled or uninstalled.
                        </Text>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-4">
                        <Text variant="body-sm" tone="secondary">
                          Plugins are installed per Project, not globally. Open the Project that
                          needs this Plugin to install and configure it there; its Capabilities then
                          become available inside that Project.
                        </Text>
                        <Button
                          variant="secondary"
                          className="self-start"
                          onClick={() => navigate('/app/projects')}
                        >
                          Open a Project to install
                          <ArrowRight width={15} height={15} aria-hidden />
                        </Button>
                        <Text variant="caption" tone="secondary">
                          Open a Project to install.
                        </Text>
                      </div>
                    )}
                  </Card>
                </div>
              </>
            );
          })()
        : null}
    </OperatorShell>
  );
}
