import { Button, Text } from '@slideops/design-system';
import { ArrowRight, Mark } from '@slideops/icons';
import { Link } from 'react-router-dom';
import { signUpUrl } from '../content/site';

/** The closing call to action: one confident invitation to get started. */
export function ClosingCta() {
  return (
    <section id="get-started" className="mx-auto max-w-6xl px-6 py-20 md:py-24">
      <div className="relative overflow-hidden rounded-xl border border-border bg-surface p-10 text-center md:p-16">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br from-subtle via-surface to-surface"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 -z-10 h-72 w-72 rounded-pill bg-highlight/40 blur-3xl"
        />
        <div className="mx-auto flex max-w-2xl flex-col items-center">
          <span className="inline-flex h-14 w-14 items-center justify-center rounded-lg border border-border bg-app">
            <Mark size={30} />
          </span>
          <Text as="h2" variant="h1" className="mt-6">
            Bring your servers. Keep the control.
          </Text>
          <Text variant="body" tone="secondary" className="mt-4 max-w-xl text-lg">
            Connect and secure your first server, then run a Project on it. Every change is planned,
            approved, verified, and recorded, so confidence is the result.
          </Text>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link to={signUpUrl}>
              <Button size="lg">
                Get started
                <ArrowRight width={18} height={18} aria-hidden />
              </Button>
            </Link>
            <a href="#model">
              <Button size="lg" variant="secondary">
                See how it works
              </Button>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
