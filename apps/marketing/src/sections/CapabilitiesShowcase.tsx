import { Text } from '@slideops/design-system';
import { dayOneCapabilities } from '../content/capabilities';

/** The day-one Capability set, each an outcome with a category and a plain description. */
export function CapabilitiesShowcase() {
  return (
    <section id="capabilities" className="mx-auto max-w-6xl px-6 py-20 md:py-24">
      <div className="so-rise max-w-2xl">
        <Text variant="caption" tone="accent">
          Capabilities
        </Text>
        <Text as="h2" variant="h1" className="mt-3">
          Searchable by outcome, never by tool
        </Text>
        <Text variant="body" tone="secondary" className="mt-5">
          These are the outcomes SlideOps delivers on day one. Each one plans, executes, verifies,
          and rolls back on its own, and adapts to the Linux family your Node runs.
        </Text>
      </div>

      <div className="so-rise-2 mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {dayOneCapabilities.map(({ icon: Icon, name, category, description }) => (
          <article
            key={name}
            className="group flex flex-col rounded-lg border border-border bg-surface p-6 transition-shadow duration-base ease-standard hover:shadow-md"
          >
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
        ))}
      </div>
    </section>
  );
}
