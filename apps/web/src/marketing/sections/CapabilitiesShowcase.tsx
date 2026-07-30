import { Text } from '@slideops/design-system';
import { Boxes, Check } from '@slideops/icons';
import {
  coreCapabilities,
  marketplaceCapabilities,
  type ShowcaseCapability,
} from '../content/capabilities';
import { useReveal } from '../useReveal';

/** The Capability set: Core security on every server, the rest from the marketplace. */
export function CapabilitiesShowcase() {
  return (
    <section id="capabilities" className="mx-auto max-w-6xl px-6 py-20 md:py-24">
      <div className="so-rise max-w-2xl">
        <Text variant="caption" tone="accent">
          Capabilities
        </Text>
        <Text as="h2" variant="h1" className="mt-3">
          Core security on every server, the rest from the marketplace
        </Text>
        <Text variant="body" tone="secondary" className="mt-5">
          Only security is Core: four outcomes pre-installed on every server, so a server is secured
          the moment you connect it. Everything else is a marketplace Plugin you install per
          Project, so each Project carries only the stack it uses. Each outcome plans, executes,
          verifies, and rolls back on its own, and adapts to the Linux family your server runs.
        </Text>
      </div>

      <CoreGroup />
      <MarketplaceGroup />
    </section>
  );
}

function CoreGroup() {
  const { ref, shown } = useReveal<HTMLDivElement>();
  return (
    <div className="mt-12">
      <div className="flex items-center gap-3">
        <span className="inline-flex items-center gap-1.5 rounded-pill bg-brand px-3 py-1 text-xs font-semibold uppercase tracking-wide text-brand-fg">
          Core
        </span>
        <Text as="span" variant="body-sm" tone="secondary">
          Pre-installed on every server, nothing to add
        </Text>
      </div>
      <div
        ref={ref}
        className={`mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 so-reveal${shown ? ' so-reveal-in' : ''}`}
      >
        {coreCapabilities.map((capability) => (
          <CapabilityCard key={capability.name} capability={capability} core />
        ))}
      </div>
    </div>
  );
}

function MarketplaceGroup() {
  const { ref, shown } = useReveal<HTMLDivElement>();
  return (
    <div className="mt-12">
      <div className="flex items-center gap-3">
        <span className="inline-flex items-center gap-1.5 rounded-pill border border-border bg-surface px-3 py-1 text-xs font-semibold uppercase tracking-wide text-accent">
          <Boxes width={13} height={13} aria-hidden />
          Marketplace
        </span>
        <Text as="span" variant="body-sm" tone="secondary">
          Installed per Project, so each Project carries only its stack
        </Text>
      </div>
      <div
        ref={ref}
        className={`mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 so-reveal${shown ? ' so-reveal-in' : ''}`}
      >
        {marketplaceCapabilities.map((capability) => (
          <CapabilityCard key={capability.name} capability={capability} />
        ))}
      </div>
    </div>
  );
}

function CapabilityCard({
  capability,
  core = false,
}: {
  capability: ShowcaseCapability;
  core?: boolean;
}) {
  const { icon: Icon, name, category, description } = capability;
  return (
    <article
      className={`so-stagger group flex flex-col rounded-lg border p-6 transition-shadow duration-base ease-standard hover:shadow-md ${
        core ? 'border-border bg-subtle' : 'border-border bg-surface'
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-md bg-app text-brand transition-transform duration-base ease-standard group-hover:-translate-y-0.5">
          <Icon width={22} height={22} aria-hidden />
        </span>
        {core ? (
          <span className="inline-flex items-center gap-1 rounded-pill bg-app px-2.5 py-0.5 text-xs font-medium text-brand">
            <Check width={12} height={12} aria-hidden />
            Built in
          </span>
        ) : (
          <span className="rounded-pill border border-border px-2.5 py-0.5 text-xs font-medium text-ink-muted">
            {category}
          </span>
        )}
      </div>
      <Text variant="h4" className="mt-4">
        {name}
      </Text>
      <Text variant="body-sm" tone="secondary" className="mt-2">
        {description}
      </Text>
    </article>
  );
}
