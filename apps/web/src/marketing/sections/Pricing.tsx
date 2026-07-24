import { Button, Text } from '@slideops/design-system';
import { ArrowRight, Check } from '@slideops/icons';
import { Link } from 'react-router-dom';
import { signUpUrl } from '../content/site';

const included = [
  'Connect and secure your own servers over SSH',
  'Core security on every server, the rest per Project from the marketplace',
  'Resource-limited Services, deployed from GitHub',
  'Plan, approve, execute, verify, and roll back',
  'Live output, monitoring, History, and notifications',
];

/** A simple pricing placeholder, clearly marked as coming soon. */
export function Pricing() {
  return (
    <section id="pricing" className="border-y border-border bg-surface">
      <div className="mx-auto max-w-6xl px-6 py-20 md:py-24">
        <div className="so-rise max-w-2xl">
          <Text variant="caption" tone="accent">
            Pricing
          </Text>
          <Text as="h2" variant="h1" className="mt-3">
            Simple pricing, coming soon
          </Text>
          <Text variant="body" tone="secondary" className="mt-5">
            Four tiers (Free, Starter, Pro, and Enterprise) will set how many servers, Projects, and
            Services you run and the CPU, memory, and disk each Service may use, so several Projects
            can share one large server under hard limits. We are still shaping the plans. While we
            do, you can start using SlideOps and run Operations on your own servers.
          </Text>
        </div>

        <div className="so-rise-2 mt-10 max-w-xl rounded-xl border border-border bg-app p-8">
          <div className="flex items-center gap-3">
            <Text variant="h3">Early access</Text>
            <span className="rounded-pill bg-subtle px-3 py-1 text-xs font-medium uppercase tracking-wide text-brand">
              Coming soon
            </span>
          </div>
          <Text variant="body-sm" tone="secondary" className="mt-2">
            Get started now and help shape what SlideOps becomes.
          </Text>
          <ul className="mt-6 flex flex-col gap-3">
            {included.map((line) => (
              <li key={line} className="flex items-center gap-3">
                <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-pill bg-subtle text-success">
                  <Check width={15} height={15} aria-hidden />
                </span>
                <Text as="span" variant="body-sm">
                  {line}
                </Text>
              </li>
            ))}
          </ul>
          <Link to={signUpUrl} className="mt-8 inline-flex">
            <Button size="lg">
              Get started
              <ArrowRight width={18} height={18} aria-hidden />
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
