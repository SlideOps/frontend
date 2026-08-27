import { Button, Text } from '@slideops/design-system';
import { ArrowRight, Check, Server } from '@slideops/icons';
import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { signUpUrl } from '../content/site';
import { fetchLivePrices } from '../live-pricing';
import { useReveal } from '../useReveal';

interface Tier {
  name: string;
  price: string;
  cadence?: string;
  blurb: string;
  highlight?: boolean;
  cta: string;
  includes?: string;
  features: string[];
}

/** The tiers meter only what SlideOps provides: the servers you connect, the
 *  Projects you run, your team seats, and your support. They never cap the CPU,
 *  memory, or disk on your own servers, that hardware is yours to use in full. */
const tiers: Tier[] = [
  {
    name: 'Free',
    price: '$0',
    cadence: 'forever',
    blurb: 'See the whole flow on one server.',
    cta: 'Start free',
    features: [
      '1 Workspace',
      '1 server',
      '1 Project',
      '1 seat per Workspace',
      'Core security on every server',
      'The full marketplace',
      '7 days of history',
      'Community support',
    ],
  },
  {
    name: 'Starter',
    price: '$19',
    cadence: 'per month',
    blurb: 'A few Projects across a couple of servers.',
    cta: 'Get started',
    includes: 'Everything in Free, plus',
    features: [
      'Up to 3 Workspaces',
      '3 servers',
      '5 Projects',
      '2 seats per Workspace',
      'Automations and scheduling',
      '30 days of history',
      'Email support',
    ],
  },
  {
    name: 'Pro',
    price: '$49',
    cadence: 'per month',
    blurb: 'Run a real fleet, with your team.',
    highlight: true,
    cta: 'Get started',
    includes: 'Everything in Starter, plus',
    features: [
      'Up to 10 Workspaces',
      '15 servers',
      '30 Projects',
      '5 seats per Workspace',
      'Advanced monitoring and reports',
      '1 year of history',
      'Audit trail',
      'Priority support',
    ],
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    blurb: 'For a whole team, at any scale.',
    cta: 'Talk to us',
    includes: 'Everything in Pro, plus',
    features: [
      'Unlimited Workspaces',
      'Unlimited servers and Projects',
      'Unlimited seats',
      'Single sign-on',
      'A self-host option',
      'An SLA and dedicated support',
    ],
  },
];

/** Pricing: we are a command center, not a host, so the tiers meter our service,
 *  never your server's resources. */
export function Pricing() {
  const { ref, shown } = useReveal<HTMLDivElement>();
  /*
   * The written-in prices above are the fallback, not the source.
   *
   * They disagreed with what checkout charged for a while, and correcting both
   * once would only have fixed it until the next Admin edit. So the page asks
   * the platform what it will actually charge, and falls back to what it shipped
   * with when the answer does not arrive. A marketing page that renders nothing
   * because an API call failed is worse than one showing a price that is very
   * nearly always right.
   */
  const [live, setLive] = useState<Record<string, string>>({});
  useEffect(() => {
    const controller = new AbortController();
    fetchLivePrices(controller.signal).then(setLive);
    return () => controller.abort();
  }, []);
  return (
    <section id="pricing" className="border-y border-border bg-surface">
      <div className="mx-auto max-w-6xl px-6 py-20 md:py-24">
        <div className="so-rise max-w-2xl">
          <Text variant="caption" tone="accent">
            Pricing
          </Text>
          <Text as="h2" variant="h1" className="mt-3">
            Priced for the command center, not your hardware
          </Text>
          <Text variant="body" tone="secondary" className="mt-5">
            Every Capability runs on your servers, never on ours, so we never cap the CPU, memory,
            or disk you already own. You use all of it. Your plan sets only what SlideOps provides:
            the servers you connect, the Projects you run, the seats on your team, and your support.
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
                tier.highlight ? 'border-brand bg-app ring-1 ring-brand' : 'border-border bg-app'
              }`}
            >
              {tier.highlight ? (
                <span className="absolute -top-3 left-6 inline-flex items-center rounded-pill bg-brand px-3 py-1 text-xs font-semibold uppercase tracking-wide text-brand-fg">
                  Most popular
                </span>
              ) : null}

              <Text variant="h3">{tier.name}</Text>
              <div className="mt-3 flex items-baseline gap-1.5">
                <Text as="span" variant="display" className="text-3xl">
                  {live[tier.name.toLowerCase()] ?? tier.price}
                </Text>
                {tier.cadence ? (
                  <Text as="span" variant="body-sm" tone="secondary">
                    {tier.cadence}
                  </Text>
                ) : null}
              </div>
              <Text variant="body-sm" tone="secondary" className="mt-2 min-h-10">
                {tier.blurb}
              </Text>

              <Link to={signUpUrl} className="mt-5 inline-flex">
                <Button
                  size="md"
                  variant={tier.highlight ? 'primary' : 'secondary'}
                  className="w-full"
                >
                  {tier.cta}
                  <ArrowRight width={16} height={16} aria-hidden />
                </Button>
              </Link>

              <div className="mt-6 border-t border-border pt-5">
                {tier.includes ? (
                  <Text variant="caption" tone="secondary" className="mb-3 block">
                    {tier.includes}
                  </Text>
                ) : null}
                <ul className="flex flex-col gap-2.5">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2.5">
                      <Check
                        width={16}
                        height={16}
                        className={`mt-0.5 shrink-0 ${tier.highlight ? 'text-brand' : 'text-accent'}`}
                        aria-hidden
                      />
                      <Text as="span" variant="body-sm">
                        {feature}
                      </Text>
                    </li>
                  ))}
                </ul>
              </div>
            </article>
          ))}
        </div>

        <div className="mt-8 flex items-start gap-3 rounded-lg border border-border bg-app p-4">
          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-pill bg-subtle text-accent">
            <Server width={16} height={16} aria-hidden />
          </span>
          <Text variant="body-sm" tone="secondary">
            Your server's resources are yours. If you want to keep Projects from crowding each
            other, you can cap a Service's CPU and memory yourself, that is your choice on your own
            server, never a limit we impose. Every plan includes the full lifecycle and Core
            security on every server.
          </Text>
        </div>
      </div>
    </section>
  );
}
