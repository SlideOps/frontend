import { Button, Text } from '@slideops/design-system';
import { ArrowRight, Logo, ShieldCheck } from '@slideops/icons';
import { Link } from 'react-router-dom';
import { signUpUrl } from '../content/site';
import { Reveal } from '../motion';

const assurances = [
  'Your servers stay yours',
  'Approval before any change',
  'Verification after every execution',
];

/** The hero: the lockup, the line, the promise, and the primary calls. */
export function Hero() {
  return (
    <section id="top" className="relative overflow-hidden">
      <div
        aria-hidden
        className="so-drift pointer-events-none absolute inset-0 -z-10 opacity-70"
        style={{
          background:
            'radial-gradient(55% 55% at 18% 22%, var(--color-bg-subtle), transparent), radial-gradient(45% 50% at 85% 12%, var(--color-highlight), transparent)',
        }}
      />
      <div className="mx-auto max-w-6xl px-6 py-24 md:py-32">
        <Reveal className="max-w-3xl">
          <div className="mb-8">
            <Logo size={44} />
          </div>
          <span className="inline-flex items-center gap-2 rounded-pill border border-border bg-surface px-3 py-1 text-xs font-medium uppercase tracking-wide text-ink-muted">
            Infrastructure Operations, in plain language
          </span>
          <Text as="h1" variant="display" className="mt-6">
            Knowledge becomes Capabilities. Capabilities create Confidence.
          </Text>
          <Text variant="body" tone="secondary" className="mt-6 max-w-2xl text-lg">
            Connect and secure your servers over SSH, then run Projects on them: install only the
            stack each Project needs, deploy resource-limited Services from GitHub, and monitor
            everything. SlideOps orchestrates and explains the tools you already run, and it never
            owns your infrastructure. You do.
          </Text>
          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Link to={signUpUrl}>
              <Button size="lg">
                Get started
                <ArrowRight width={18} height={18} aria-hidden />
              </Button>
            </Link>
            <a href="#how">
              <Button size="lg" variant="secondary">
                See how it works
              </Button>
            </a>
          </div>
          <ul className="mt-10 flex flex-wrap gap-x-6 gap-y-3">
            {assurances.map((line) => (
              <li key={line} className="flex items-center gap-2">
                <ShieldCheck width={18} height={18} className="text-brand" aria-hidden />
                <Text as="span" variant="body-sm" tone="secondary">
                  {line}
                </Text>
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </section>
  );
}
