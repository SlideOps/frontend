import { Text } from '@slideops/design-system';
import { Boxes, Check } from '@slideops/icons';
import {
  coreCapabilities,
  marketplaceCapabilities,
  type ShowcaseCapability,
} from '../content/capabilities';
import { Glow, Grain, Reveal } from '../motion';

/** Seconds each successive card waits before it reveals, so a grid arrives in a wave. */
const CARD_STAGGER = 0.06;

/**
 * A single Core Capability: a built-in security outcome, marked so it reads as
 * pre-installed on every server rather than something to add.
 */
function CoreCard({ capability, index }: { capability: ShowcaseCapability; index: number }) {
  const { icon: Icon, name, description } = capability;
  return (
    <Reveal delay={index * CARD_STAGGER} className="h-full">
      <article className="flex h-full flex-col rounded-lg border border-border bg-surface p-5">
        <div className="flex items-center justify-between gap-3">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-md bg-subtle text-brand">
            <Icon width={22} height={22} aria-hidden />
          </span>
          <span className="inline-flex items-center gap-1 rounded-pill bg-subtle px-2.5 py-0.5 text-xs font-medium text-accent">
            <Check width={12} height={12} aria-hidden />
            Built in
          </span>
        </div>
        <Text variant="h4" className="mt-4">
          {name}
        </Text>
        <Text variant="body-sm" tone="secondary" className="mt-2">
          {description}
        </Text>
      </article>
    </Reveal>
  );
}

/**
 * A single marketplace Plugin: an outcome installed per Project, tagged with its
 * category so the open, pick-what-you-need catalogue reads distinct from Core.
 */
function MarketplaceCard({ capability, index }: { capability: ShowcaseCapability; index: number }) {
  const { icon: Icon, name, category, description } = capability;
  return (
    <Reveal delay={index * CARD_STAGGER} className="h-full">
      <article className="group flex h-full flex-col rounded-lg border border-border bg-surface p-5 transition-shadow duration-base ease-standard hover:shadow-md">
        <div className="flex items-center justify-between gap-3">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-md bg-subtle text-brand">
            <Icon width={22} height={22} aria-hidden />
          </span>
          <span className="rounded-pill border border-border px-2.5 py-0.5 text-xs font-medium text-ink-muted">
            {category}
          </span>
        </div>
        <Text variant="h4" className="mt-4">
          {name}
        </Text>
        <Text variant="body-sm" tone="secondary" className="mt-2">
          {description}
        </Text>
      </article>
    </Reveal>
  );
}

/**
 * The Capabilities and marketplace beat, on the warm-light paper-world. It sets
 * the four pre-installed Core security Capabilities apart from the open
 * marketplace of Plugins an Operator installs per Project, so the two-part model
 * reads at a glance: a server is secured the moment it is connected, and each
 * Project then carries only the stack it uses. Cards reveal in a gentle wave as
 * the section scrolls into view, with soft warm glow accents from the palette.
 */
export function CapabilitiesShowcase() {
  return (
    <section id="capabilities" className="so-paper-world relative isolate overflow-hidden">
      {/* A little ambient warmth and the tactile grain, decorative and behind copy. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <Glow color="ember" size="34rem" x="90%" y="6%" />
        <Glow color="rose" size="30rem" x="2%" y="96%" />
        <Grain style={{ position: 'absolute' }} />
      </div>

      <div className="mx-auto max-w-6xl px-6 py-20 md:py-24">
        <Reveal className="max-w-2xl">
          <Text variant="caption" tone="accent">
            Capabilities
          </Text>
          <Text as="h2" variant="h1" className="mt-3">
            Core security on every server, the rest from the marketplace
          </Text>
          <Text variant="body" tone="secondary" className="mt-5">
            The four Core Capabilities are pre-installed on every server, so a server is secured the
            moment you connect it. Everything after them is a marketplace Plugin you install per
            Project, so each Project carries only the stack it uses. Every Capability plans,
            executes, verifies, and rolls back on its own, and adapts to the Linux family your server
            runs.
          </Text>
        </Reveal>

        {/* Core: grouped in a tinted panel so the pre-installed set reads as built-in. */}
        <div className="mt-14">
          <Reveal className="flex flex-wrap items-center gap-3">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-subtle text-brand">
              <Check width={18} height={18} aria-hidden />
            </span>
            <Text variant="h3">Core security, pre-installed</Text>
            <span className="rounded-pill border border-[color:var(--so-cognac)] px-3 py-0.5 text-xs font-medium text-accent">
              On every server, nothing to add
            </span>
          </Reveal>

          <Reveal delay={0.05} className="mt-6">
            <div className="rounded-2xl border border-[color:var(--so-cognac)] bg-subtle p-5 md:p-7">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {coreCapabilities.map((capability, index) => (
                  <CoreCard key={capability.name} capability={capability} index={index} />
                ))}
              </div>
            </div>
          </Reveal>
        </div>

        {/* Marketplace: the open catalogue, installed per Project. */}
        <div className="mt-16">
          <Reveal className="flex flex-wrap items-center gap-3">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-subtle text-brand">
              <Boxes width={18} height={18} aria-hidden />
            </span>
            <Text variant="h3">The marketplace, installed per Project</Text>
            <span className="rounded-pill border border-border px-3 py-0.5 text-xs font-medium text-ink-muted">
              Pick what each Project needs
            </span>
          </Reveal>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {marketplaceCapabilities.map((capability, index) => (
              <MarketplaceCard key={capability.name} capability={capability} index={index} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
