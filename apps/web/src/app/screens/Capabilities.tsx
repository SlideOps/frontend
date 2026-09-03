import { listCapabilities, type Capability } from '@slideops/api-client';
import { Button, Card, Text } from '@slideops/design-system';
import { ArrowRight, Grid3x3, Layers, Search, ShieldCheck } from '@slideops/icons';
import { Guidance } from '@slideops/tooltips';
import { EmptyState, PageHeader } from '@slideops/ui';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CapabilityCard } from '../components/CapabilityCard';
import { ErrorNote, Loading } from '../components/Feedback';
import { OperatorShell } from '../components/OperatorShell';
import { useAsyncData } from '../hooks/useAsyncData';

/** Group Capabilities by their category, categories in alphabetical order. */
function groupByCategory(capabilities: Capability[]): [string, Capability[]][] {
  const groups = new Map<string, Capability[]>();
  for (const capability of capabilities) {
    const category = capability.category || 'Other';
    const list = groups.get(category) ?? [];
    list.push(capability);
    groups.set(category, list);
  }
  return Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0]));
}

/** The Capability catalog: every outcome, grouped by category, searchable. */
export function Capabilities() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const catalog = useAsyncData(
    (signal) => listCapabilities({ q: query.trim() || undefined }, signal),
    [query],
  );

  return (
    <OperatorShell active="capabilities">
      <PageHeader
        title="Capabilities"
        description="Search for the outcome you want, not the technology behind it. Every Capability shows its risk, and nothing runs before you approve a plan."
        guidanceKey="node.capabilities"
        actions={
          <Button variant="secondary" onClick={() => navigate('/app/capabilities/matrix')}>
            <Grid3x3 width={16} height={16} aria-hidden />
            Capability matrix
          </Button>
        }
      />

      <Card className="mb-8 flex items-start gap-3">
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-subtle text-brand">
          <ShieldCheck width={18} height={18} aria-hidden />
        </span>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Text variant="h4">Core security Capabilities</Text>
            <Guidance for="capability.core" />
          </div>
          <Text variant="body-sm" tone="secondary" className="mt-1 block">
            These run on any server with no Project. More Capabilities become available inside a
            Project once you install its Plugin from the Marketplace.
          </Text>
        </div>
      </Card>

      <div className="mb-8 flex max-w-xl items-center gap-2 rounded-md border border-border bg-surface px-3 shadow-sm">
        <Search width={18} height={18} className="text-ink-muted" aria-hidden />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by outcome, for example secure SSH or enable HTTPS"
          aria-label="Search Capabilities by outcome"
          className="h-10 w-full bg-transparent text-sm text-ink placeholder:text-ink-muted focus-visible:outline-none"
        />
        <Guidance for="capability.search" />
      </div>

      {catalog.state.status === 'loading' ? <Loading label="Loading the catalog" /> : null}
      {catalog.state.status === 'error' ? <ErrorNote error={catalog.state.error} /> : null}
      {catalog.state.status === 'ready' ? (
        catalog.state.data.length === 0 ? (
          <EmptyState
            icon={Layers}
            title="No Capabilities match"
            description="Try a different outcome, or clear the search to see everything available."
          />
        ) : (
          <div className="flex flex-col gap-8">
            {groupByCategory(catalog.state.data).map(([category, capabilities]) => (
              <section key={category}>
                <div className="mb-3 flex items-center justify-between gap-2 border-b border-border pb-3">
                  <Text variant="h3">{category}</Text>
                  <span className="rounded-pill bg-subtle px-2 py-0.5 text-xs font-medium text-ink-muted">
                    {capabilities.length}
                  </span>
                </div>
                <div className="grid border-y border-border bg-surface lg:grid-cols-2 lg:gap-x-8">
                  {capabilities.map((capability) => (
                    <CapabilityCard
                      key={capability.key}
                      capability={capability}
                      footer={
                        <Button
                          variant="ghost"
                          size="sm"
                          className="px-0"
                          onClick={() => navigate(`/app/capabilities/${capability.key}`)}
                        >
                          View and start on a Node
                          <ArrowRight width={15} height={15} aria-hidden />
                        </Button>
                      }
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )
      ) : null}
    </OperatorShell>
  );
}
