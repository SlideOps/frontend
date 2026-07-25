import { listMarketplacePlugins, type Plugin } from '@slideops/api-client';
import { Button, Card, Text } from '@slideops/design-system';
import { ArrowRight, Boxes, Check, Package, Search } from '@slideops/icons';
import { Guidance } from '@slideops/tooltips';
import { EmptyState, PageHeader } from '@slideops/ui';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Collapsible } from '../components/Collapsible';
import { ErrorNote, Loading } from '../components/Feedback';
import { OperatorShell } from '../components/OperatorShell';
import { useAsyncData } from '../hooks/useAsyncData';

/** Group Plugins by their category, categories in alphabetical order. */
function groupByCategory(plugins: Plugin[]): [string, Plugin[]][] {
  const groups = new Map<string, Plugin[]>();
  for (const plugin of plugins) {
    const category = plugin.category || 'Other';
    const list = groups.get(category) ?? [];
    list.push(plugin);
    groups.set(category, list);
  }
  return Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0]));
}

/** Match a Plugin against a plain-language query across its name, outcome, and what it provides. */
function matches(plugin: Plugin, query: string): boolean {
  if (!query) {
    return true;
  }
  const haystack = [
    plugin.name,
    plugin.category,
    plugin.description,
    ...(plugin.provides ?? []),
  ]
    .join(' ')
    .toLowerCase();
  return haystack.includes(query.toLowerCase());
}

/** One Plugin presented as a card, with its outcome, what it provides, and its install state. */
function PluginCard({ plugin, onOpen }: { plugin: Plugin; onOpen: () => void }) {
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-subtle text-brand">
          <Boxes width={18} height={18} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <Text variant="h4">{plugin.name}</Text>
          <Text variant="caption" tone="secondary" className="mt-0.5 block">
            {plugin.category}
          </Text>
        </div>
        {plugin.installed ? (
          <span className="inline-flex items-center gap-1.5 rounded-pill bg-subtle px-2.5 py-0.5 text-xs font-medium text-success">
            <Check width={12} height={12} aria-hidden />
            {plugin.is_core ? 'Built in' : 'Installed'}
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

      <button
        type="button"
        onClick={onOpen}
        className="mt-1 inline-flex items-center gap-1 self-start text-sm font-medium text-brand transition-colors duration-fast ease-standard hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
      >
        View details
        <ArrowRight width={15} height={15} aria-hidden />
      </button>
    </Card>
  );
}

/**
 * The Marketplace: the curated catalog of first-party Plugins, grouped by
 * category and searchable by outcome. Each Plugin bundles Capabilities an
 * Operator installs to unlock; the Core bundle shows as built in. Opening a
 * Plugin leads to its manifest, what it adds, and the install action.
 */
export function Marketplace() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const catalog = useAsyncData((signal) => listMarketplacePlugins(undefined, signal), []);

  const filtered = useMemo(() => {
    if (catalog.state.status !== 'ready') {
      return [];
    }
    const q = query.trim();
    return catalog.state.data.filter((plugin) => matches(plugin, q));
  }, [catalog.state, query]);

  return (
    <OperatorShell active="marketplace">
      <PageHeader
        title="Marketplace"
        description="Browse the first-party Plugins that unlock more Capabilities. Each Plugin bundles what it needs behind one manifest, and everything it adds runs inside the same discover, plan, approve, execute, and verify loop. Plugins are installed per Project, so open a Project to install the ones it needs."
        guidanceKey="marketplace.overview"
      />

      <Card className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-subtle text-brand">
            <Boxes width={18} height={18} aria-hidden />
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Text variant="h4">Installed per Project</Text>
              <Guidance for="marketplace.perProject" />
            </div>
            <Text variant="body-sm" tone="secondary" className="mt-1 block">
              The Core security bundle is on every server. Every other Plugin installs into a Project,
              so each Project carries only the stack it needs. Open a Project to install.
            </Text>
          </div>
        </div>
        <Button variant="secondary" className="shrink-0" onClick={() => navigate('/app/projects')}>
          Open a Project to install
          <ArrowRight width={15} height={15} aria-hidden />
        </Button>
      </Card>

      <div className="mb-8 flex max-w-md items-center gap-2 rounded-md border border-border bg-surface px-3">
        <Search width={18} height={18} className="text-ink-muted" aria-hidden />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by outcome, for example database or runtime"
          aria-label="Search Plugins by outcome"
          className="h-10 w-full bg-transparent text-sm text-ink placeholder:text-ink-muted focus-visible:outline-none"
        />
        <Guidance for="marketplace.search" />
      </div>

      {catalog.state.status === 'loading' ? <Loading label="Loading the Marketplace" /> : null}
      {catalog.state.status === 'error' ? <ErrorNote error={catalog.state.error} /> : null}
      {catalog.state.status === 'ready' ? (
        filtered.length === 0 ? (
          <EmptyState
            icon={Package}
            title="No Plugins match"
            description="Try a different outcome, or clear the search to see every Plugin available."
          />
        ) : (
          <div className="flex flex-col gap-3">
            {groupByCategory(filtered).map(([category, plugins], index) => {
              // Clean by default: only the first category opens; the Operator
              // expands the rest. While searching, open every category so a match in
              // any of them is visible. The search flag is in the key so toggling it
              // remounts and re-applies the open state.
              const searching = query.trim().length > 0;
              return (
              <Collapsible
                key={`${category}-${searching}`}
                title={category}
                summary={
                  <span className="rounded-pill bg-subtle px-2 py-0.5 text-xs font-medium text-ink-muted">
                    {plugins.length}
                  </span>
                }
                defaultOpen={index === 0 || searching}
              >
                <div className="grid gap-4 lg:grid-cols-2">
                  {plugins.map((plugin) => (
                    <PluginCard
                      key={plugin.id}
                      plugin={plugin}
                      onOpen={() => navigate(`/app/marketplace/${plugin.id}`)}
                    />
                  ))}
                </div>
              </Collapsible>
              );
            })}
          </div>
        )
      ) : null}
    </OperatorShell>
  );
}
