import { Button, Text } from '@slideops/design-system';
import { ArrowRight, Check, Server } from '@slideops/icons';
import { Link } from 'react-router-dom';
import { signUpUrl } from '../content/site';
import { useReveal } from '../useReveal';

interface Tier {
  name: string;
  blurb: string;
  highlight?: boolean;
  quotas: { label: string; value: string }[];
}

/** The four tiers, with the exact quotas that bound what an Operator can run. */
const tiers: Tier[] = [
  {
    name: 'Free',
    blurb: 'Try the whole flow on one server.',
    quotas: [
      { label: 'Servers', value: '1' },
      { label: 'Projects', value: '1' },
      { label: 'Services', value: '1' },
      { label: 'vCPU per Service', value: '1.0' },
      { label: 'Memory per Service', value: '1 GB' },
      { label: 'Disk per Service', value: '5 GB' },
    ],
  },
  {
    name: 'Starter',
    blurb: 'A few Projects on a small footprint.',
    quotas: [
      { label: 'Servers', value: '2' },
      { label: 'Projects', value: '3' },
      { label: 'Services', value: '5' },
      { label: 'vCPU per Service', value: '2.0' },
      { label: 'Memory per Service', value: '4 GB' },
      { label: 'Disk per Service', value: '20 GB' },
    ],
  },
  {
    name: 'Pro',
    blurb: 'Room to run many Projects on one big server.',
    highlight: true,
    quotas: [
      { label: 'Servers', value: '10' },
      { label: 'Projects', value: '20' },
      { label: 'Services', value: '50' },
      { label: 'vCPU per Service', value: '8.0' },
      { label: 'Memory per Service', value: '16 GB' },
      { label: 'Disk per Service', value: '100 GB' },
    ],
  },
  {
    name: 'Enterprise',
    blurb: 'Fleet-scale limits for a whole team.',
    quotas: [
      { label: 'Servers', value: '100' },
      { label: 'Projects', value: '200' },
      { label: 'Services', value: '500' },
      { label: 'vCPU per Service', value: '64.0' },
      { label: 'Memory per Service', value: '256 GB' },
      { label: 'Disk per Service', value: '1000 GB' },
    ],
  },
];

/** Pricing: the four tiers and the exact quotas, with the shared-server story. */
export function Pricing() {
  const { ref, shown } = useReveal<HTMLDivElement>();
  return (
    <section id="pricing" className="border-y border-border bg-surface">
      <div className="mx-auto max-w-6xl px-6 py-20 md:py-24">
        <div className="so-rise max-w-2xl">
          <Text variant="caption" tone="accent">
            Tiers and resource hosting
          </Text>
          <Text as="h2" variant="h1" className="mt-3">
            Run many Projects on one server, under hard limits
          </Text>
          <Text variant="body" tone="secondary" className="mt-5">
            Your tier sets how many servers, Projects, and Services you run, and the CPU, memory, and
            disk each Service may use. Because every Service runs under a fixed ceiling, several
            Projects share one large server without fighting for resources.
          </Text>
        </div>

        <div
          ref={ref}
          className={`mt-12 grid gap-5 md:grid-cols-2 xl:grid-cols-4 so-reveal${shown ? ' so-reveal-in' : ''}`}
        >
          {tiers.map((tier) => (
            <article
              key={tier.name}
              className={`so-stagger relative flex flex-col rounded-xl border p-6 transition-shadow duration-base ease-standard hover:shadow-lg ${
                tier.highlight
                  ? 'border-brand bg-app ring-1 ring-brand'
                  : 'border-border bg-app'
              }`}
            >
              {tier.highlight ? (
                <span className="absolute -top-3 left-6 inline-flex items-center rounded-pill bg-brand px-3 py-1 text-xs font-semibold uppercase tracking-wide text-brand-fg">
                  Most popular
                </span>
              ) : null}
              <div className="flex items-center gap-2">
                <Server
                  width={18}
                  height={18}
                  className={tier.highlight ? 'text-brand' : 'text-accent'}
                  aria-hidden
                />
                <Text variant="h3">{tier.name}</Text>
              </div>
              <Text variant="body-sm" tone="secondary" className="mt-2 min-h-10">
                {tier.blurb}
              </Text>
              <dl className="mt-5 flex flex-col gap-2.5 border-t border-border pt-5">
                {tier.quotas.map((quota) => (
                  <div key={quota.label} className="flex items-baseline justify-between gap-3">
                    <dt>
                      <Text as="span" variant="body-sm" tone="secondary">
                        {quota.label}
                      </Text>
                    </dt>
                    <dd>
                      <Text as="span" variant="body-sm" className="font-semibold">
                        {quota.value}
                      </Text>
                    </dd>
                  </div>
                ))}
              </dl>
              <Link to={signUpUrl} className="mt-6 inline-flex">
                <Button
                  size="md"
                  variant={tier.highlight ? 'primary' : 'secondary'}
                  className="w-full"
                >
                  Get started
                  <ArrowRight width={16} height={16} aria-hidden />
                </Button>
              </Link>
            </article>
          ))}
        </div>

        <div className="mt-8 flex items-center gap-3 rounded-lg border border-border bg-app p-4">
          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-pill bg-subtle text-success">
            <Check width={16} height={16} aria-hidden />
          </span>
          <Text variant="body-sm" tone="secondary">
            Every tier includes the full lifecycle: plan, approve, execute, verify, and roll back,
            with Core security on every server and the marketplace per Project.
          </Text>
        </div>
      </div>
    </section>
  );
}
