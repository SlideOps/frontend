import { Button, Text } from '@slideops/design-system';
import {
  ArrowRight,
  Check,
  Logo,
  Server,
  ShieldCheck,
  Terminal,
} from '@slideops/icons';
import { Link } from 'react-router-dom';
import { signUpUrl } from '../content/site';

const assurances = [
  'Your servers stay yours',
  'Approval before any change',
  'Verification after every execution',
];

const families = ['Ubuntu', 'Debian', 'Fedora', 'Arch', 'Alpine', 'openSUSE'];

/** The hero: the lockup, the line, the promise, the primary calls, and a calm
 *  token-only product visual that hints at a secured server and a live plan. */
export function Hero() {
  return (
    <section id="top" className="relative overflow-hidden">
      <div
        aria-hidden
        className="so-drift pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br from-subtle via-app to-app opacity-80"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-40 -top-40 -z-10 h-96 w-96 rounded-pill bg-highlight/40 blur-3xl"
      />
      <div className="mx-auto grid max-w-6xl gap-12 px-6 py-20 md:py-28 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
        <div className="so-rise max-w-2xl">
          <div className="mb-8">
            <Logo size={44} />
          </div>
          <span className="inline-flex items-center gap-2 rounded-pill border border-border bg-surface px-3 py-1 text-xs font-medium uppercase tracking-wide text-ink-muted">
            <ShieldCheck width={14} height={14} className="text-brand" aria-hidden />
            Infrastructure Operations, in plain language
          </span>
          <Text as="h1" variant="display" className="mt-6">
            Run your own servers with the confidence of a whole platform team.
          </Text>
          <Text variant="body" tone="secondary" className="mt-6 max-w-2xl text-lg">
            SlideOps helps you discover, configure, deploy, secure, verify, and monitor your own
            Linux servers over SSH. It orchestrates and explains the tools you already run (Docker,
            systemd, apt, NGINX, Git), and it never owns your infrastructure. You do.
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
          <div className="mt-8">
            <Text as="span" variant="caption" tone="secondary">
              Works across the major Linux families
            </Text>
            <ul className="mt-3 flex flex-wrap gap-2">
              {families.map((family) => (
                <li
                  key={family}
                  className="rounded-pill border border-border bg-surface px-3 py-1 text-xs font-medium text-ink-muted"
                >
                  {family}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <HeroVisual />
      </div>
    </section>
  );
}

/** A layered, token-only product motif: a secured server, then a plan awaiting
 *  approval and passing verification. No canvas, no network graph, just tokens. */
function HeroVisual() {
  return (
    <div className="so-rise-2 relative mx-auto w-full max-w-md lg:max-w-none">
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-4 -z-10 rounded-xl bg-gradient-to-br from-brand/10 via-transparent to-highlight/20 blur-2xl"
      />
      <div className="rounded-xl border border-border bg-surface p-5 shadow-lg">
        {/* Server posture header */}
        <div className="flex items-center gap-3 rounded-lg border border-border bg-raised px-4 py-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-subtle text-brand">
            <Server width={20} height={20} aria-hidden />
          </span>
          <div className="min-w-0">
            <Text as="span" variant="body-sm" className="block font-semibold">
              edge-01
            </Text>
            <Text as="span" variant="caption" tone="secondary">
              Secured, no root, non-root sudo
            </Text>
          </div>
          <span className="ml-auto inline-flex items-center gap-1.5 rounded-pill border border-border bg-app px-2.5 py-1 text-xs font-medium text-success">
            <ShieldCheck width={13} height={13} aria-hidden />
            Hardened
          </span>
        </div>

        {/* Live plan / terminal-style panel */}
        <div className="mt-4 rounded-lg border border-border bg-app p-4">
          <div className="flex items-center gap-2">
            <Terminal width={15} height={15} className="text-accent" aria-hidden />
            <Text as="span" variant="caption" tone="secondary">
              Plan awaiting approval
            </Text>
          </div>
          <ul className="mt-3 flex flex-col gap-2 font-mono text-xs text-ink-muted">
            <li className="flex items-center gap-2">
              <Check width={14} height={14} className="text-success" aria-hidden />
              install container runtime
            </li>
            <li className="flex items-center gap-2">
              <Check width={14} height={14} className="text-success" aria-hidden />
              pull main from github
            </li>
            <li className="flex items-center gap-2">
              <Check width={14} height={14} className="text-success" aria-hidden />
              start service, 2 vCPU, 4 GB
            </li>
          </ul>
          <div className="mt-4 flex items-center gap-2">
            <span className="inline-flex items-center rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-brand-fg">
              Approve
            </span>
            <span className="inline-flex items-center rounded-md border border-border px-3 py-1.5 text-xs font-medium text-ink-muted">
              Review
            </span>
          </div>
        </div>

        {/* Verification result */}
        <div className="mt-4 flex items-center gap-3 rounded-lg border border-border bg-raised px-4 py-3">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-pill bg-subtle text-success">
            <Check width={16} height={16} aria-hidden />
          </span>
          <Text as="span" variant="body-sm">
            Verified and recorded. Rollback ready if a check fails.
          </Text>
        </div>
      </div>
    </div>
  );
}
