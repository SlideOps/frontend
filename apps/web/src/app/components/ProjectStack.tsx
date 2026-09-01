import {
  ApiError,
  installPlugin,
  listInstalledPlugins,
  listMarketplacePlugins,
  uninstallPlugin,
  updatePlugin,
  type Plugin,
} from '@slideops/api-client';
import { Button, Card, Section, Text } from '@slideops/design-system';
import { ArrowRight, Boxes, capabilityIcon, Check, ShieldCheck } from '@slideops/icons';
import { Guidance } from '@slideops/tooltips';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCanWrite } from '../../store/workspace';
import { useAsyncData } from '../hooks/useAsyncData';
import { ConfirmDialog } from './ConfirmDialog';
import { ErrorNote, Loading } from './Feedback';

/** A catalog Plugin merged with its per-Project enabled state. */
interface StackPlugin extends Plugin {
  enabled: boolean;
}

async function loadStack(projectId: string, signal: AbortSignal): Promise<StackPlugin[]> {
  const [catalog, installed] = await Promise.all([
    listMarketplacePlugins(projectId, signal),
    listInstalledPlugins(projectId, signal),
  ]);
  // The catalog carries installed and is_core for this Project; the installed
  // list carries the enabled flag the catalog flattens away, so we merge them.
  const enabledById = new Map(installed.map((entry) => [entry.plugin_id, entry.enabled]));
  return catalog.map((plugin) => ({ ...plugin, enabled: enabledById.get(plugin.id) ?? false }));
}

/**
 * One Plugin as a card in the Project stack, with its per-Project install state
 * and the actions that act on this Project: install, enable or disable, and
 * uninstall. The Core bundle shows as built in and is never installable or
 * removable.
 */
function StackCard({
  plugin,
  busy,
  onInstall,
  onToggle,
  onUninstall,
  onOpen,
  openLabel,
}: {
  plugin: StackPlugin;
  busy: boolean;
  onInstall: () => void;
  onToggle: () => void;
  onUninstall: () => void;
  onOpen: () => void;
  /** "Manage" when onOpen goes straight to this Capability's own management
   * page (only possible once we know which Node), "Details" when it only goes
   * to the read-only Marketplace catalog entry. */
  openLabel: 'Manage' | 'Details';
}) {
  const canWrite = useCanWrite();
  const Icon = plugin.provides?.[0]
    ? capabilityIcon({ key: plugin.provides[0], category: plugin.category })
    : Boxes;
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-subtle text-brand">
          <Icon width={18} height={18} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <Text variant="h4">{plugin.name}</Text>
          <Text variant="caption" tone="secondary" className="mt-0.5 block">
            {plugin.category}
          </Text>
        </div>
        {plugin.is_core ? (
          <span className="inline-flex items-center gap-1.5 rounded-pill bg-subtle px-2.5 py-0.5 text-xs font-medium text-success">
            <ShieldCheck width={12} height={12} aria-hidden />
            Built in
          </span>
        ) : plugin.installed ? (
          <span className="inline-flex items-center gap-1.5 rounded-pill bg-subtle px-2.5 py-0.5 text-xs font-medium text-success">
            <Check width={12} height={12} aria-hidden />
            {plugin.enabled ? 'Installed' : 'Disabled'}
          </span>
        ) : (
          <span className="rounded-pill bg-subtle px-2.5 py-0.5 text-xs font-medium text-ink-muted">
            Available
          </span>
        )}
      </div>

      <Text variant="body-sm" tone="secondary">
        {plugin.description}
      </Text>

      {plugin.provides && plugin.provides.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {plugin.provides.map((key) => (
            <span
              key={key}
              className="rounded-pill border border-border bg-surface px-2 py-0.5 text-xs text-ink-muted"
            >
              {key}
            </span>
          ))}
        </div>
      ) : null}

      <div className="mt-1 flex flex-wrap items-center gap-2">
        {plugin.is_core ? (
          <Text variant="caption" tone="secondary">
            The Core security bundle is on every server and cannot be removed.
          </Text>
        ) : !canWrite ? null : plugin.installed ? (
          <>
            <Button variant="secondary" size="sm" onClick={onToggle} disabled={busy}>
              {plugin.enabled ? 'Disable' : 'Enable'}
            </Button>
            <Button variant="ghost" size="sm" onClick={onUninstall} disabled={busy}>
              Uninstall
            </Button>
          </>
        ) : (
          <Button size="sm" onClick={onInstall} disabled={busy}>
            {busy ? 'Installing' : 'Install'}
          </Button>
        )}
        <button
          type="button"
          onClick={onOpen}
          className="ml-auto inline-flex items-center gap-1 text-sm font-medium text-brand transition-colors duration-fast ease-standard hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        >
          {openLabel}
          <ArrowRight width={15} height={15} aria-hidden />
        </button>
      </div>
    </Card>
  );
}

/**
 * The Project stack: the per-Project Marketplace. Installing, enabling, and
 * uninstalling act on this Project, so it carries only the Plugins it needs.
 * This is the real install-per-project surface the global Marketplace points to.
 *
 * Split into what is actually there and what is not, rather than one mixed
 * grid: an Operator looking at a Node or Service wants "what do I have" first,
 * and "what could I add" as a clearly separate, secondary question, not the
 * two interleaved.
 *
 * nodeId is optional and only meaningful when this is mounted somewhere that
 * already has one Node in view (a Service's own page, not the Project page
 * itself, which has none). When it is present, an installed Capability's own
 * card opens straight into that Capability's management page for this Node,
 * which is where its real visual manager (Sites, Queues, the Database
 * Explorer, and so on) actually lives; without one there is nowhere to send
 * that link, so it falls back to the read-only Marketplace catalog entry.
 *
 * serviceId is optional too, carried the same way. When mounted from a
 * Service's own page it is that Service's id, and it rides along in the
 * Manage link's query string so the management page it opens can narrow a
 * database engine's Browse tab and credentials down to what this one Service
 * actually uses, instead of everything on the whole Node.
 */
export function ProjectStack({
  projectId,
  nodeId,
  serviceId,
}: {
  projectId: string;
  nodeId?: string;
  serviceId?: string;
}) {
  const navigate = useNavigate();
  const { state, reload } = useAsyncData((signal) => loadStack(projectId, signal), [projectId]);

  const [busyId, setBusyId] = useState<string | null>(null);
  const [pendingUninstall, setPendingUninstall] = useState<StackPlugin | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const runInstall = async (plugin: StackPlugin) => {
    setBusyId(plugin.id);
    setActionError(null);
    try {
      await installPlugin(projectId, { plugin_id: plugin.id });
      reload();
    } catch (error) {
      setActionError(
        error instanceof ApiError
          ? error.message
          : 'That Plugin could not be installed. Try again.',
      );
    } finally {
      setBusyId(null);
    }
  };

  const runToggle = async (plugin: StackPlugin) => {
    setBusyId(plugin.id);
    setActionError(null);
    try {
      await updatePlugin(projectId, plugin.id, { enabled: !plugin.enabled });
      reload();
    } catch (error) {
      setActionError(
        error instanceof ApiError ? error.message : 'That Plugin could not be updated. Try again.',
      );
    } finally {
      setBusyId(null);
    }
  };

  const runUninstall = async () => {
    if (!pendingUninstall) {
      return;
    }
    setBusyId(pendingUninstall.id);
    setActionError(null);
    try {
      await uninstallPlugin(projectId, pendingUninstall.id);
      setPendingUninstall(null);
      reload();
    } catch (error) {
      setPendingUninstall(null);
      setActionError(
        error instanceof ApiError
          ? error.message
          : 'That Plugin could not be uninstalled. Try again.',
      );
    } finally {
      setBusyId(null);
    }
  };

  // openFor decides where a card's Manage/Details button goes, and which
  // label it wears, for one Plugin.
  function openFor(plugin: StackPlugin): { onOpen: () => void; label: 'Manage' | 'Details' } {
    const installed = plugin.is_core || plugin.installed;
    if (installed && nodeId && plugin.provides && plugin.provides.length > 0) {
      const query = `?node=${nodeId}&project=${projectId}${serviceId ? `&service=${serviceId}` : ''}`;
      return { onOpen: () => navigate(`/app/capabilities/${plugin.provides[0]}${query}`), label: 'Manage' };
    }
    return { onOpen: () => navigate(`/app/marketplace/${plugin.id}`), label: 'Details' };
  }

  const installed = state.status === 'ready' ? state.data.filter((p) => p.is_core || p.installed) : [];
  const available = state.status === 'ready' ? state.data.filter((p) => !p.is_core && !p.installed) : [];

  return (
    <Section
      title="Stack"
      description="What this Project actually has installed, and what else is in the Marketplace and could be added. Install only what this Project needs; each one unlocks its Capabilities here and its Services can use them."
      adornment={<Guidance for="project.stack" />}
    >
      {state.status === 'loading' ? <Loading label="Loading the Project stack" /> : null}
      {state.status === 'error' ? <ErrorNote error={state.error} /> : null}
      {actionError ? (
        <p role="alert" className="text-sm text-danger">
          {actionError}
        </p>
      ) : null}
      {state.status === 'ready' ? (
        <div className="flex flex-col gap-6">
          <div>
            <Text variant="caption" tone="secondary" className="mb-3 block">
              Installed
            </Text>
            {installed.length === 0 ? (
              <Text variant="body-sm" tone="secondary">
                Nothing is installed yet.
              </Text>
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                {installed.map((plugin) => {
                  const open = openFor(plugin);
                  return (
                    <StackCard
                      key={plugin.id}
                      plugin={plugin}
                      busy={busyId === plugin.id}
                      onInstall={() => runInstall(plugin)}
                      onToggle={() => runToggle(plugin)}
                      onUninstall={() => setPendingUninstall(plugin)}
                      onOpen={open.onOpen}
                      openLabel={open.label}
                    />
                  );
                })}
              </div>
            )}
          </div>

          {available.length > 0 ? (
            <div>
              <Text variant="caption" tone="secondary" className="mb-3 block">
                Available to add
              </Text>
              <div className="grid gap-4 lg:grid-cols-2">
                {available.map((plugin) => {
                  const open = openFor(plugin);
                  return (
                    <StackCard
                      key={plugin.id}
                      plugin={plugin}
                      busy={busyId === plugin.id}
                      onInstall={() => runInstall(plugin)}
                      onToggle={() => runToggle(plugin)}
                      onUninstall={() => setPendingUninstall(plugin)}
                      onOpen={open.onOpen}
                      openLabel={open.label}
                    />
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      <ConfirmDialog
        open={pendingUninstall !== null}
        title="Uninstall this Plugin?"
        description={
          <>
            This removes <span className="font-medium text-ink">{pendingUninstall?.name}</span> from
            this Project. Its Capabilities stop being available here, and Services that rely on it
            may no longer deploy. It stays in the Marketplace and can be installed again.
          </>
        }
        confirmLabel="Uninstall"
        confirmVariant="danger"
        onConfirm={runUninstall}
        onCancel={() => setPendingUninstall(null)}
      />
    </Section>
  );
}
