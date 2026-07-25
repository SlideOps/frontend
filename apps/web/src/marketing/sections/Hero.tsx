import { Button, Text } from '@slideops/design-system';
import {
  ArrowRight,
  Check,
  Cpu,
  FolderKanban,
  GitBranch,
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
  'Verified after every execution',
];

const families = ['Ubuntu', 'Debian', 'Fedora', 'Arch', 'Alpine', 'openSUSE'];

/** The hero: the lockup, a confident line with a warm accent, the promise, the
 *  primary calls, and a layered, gently living product visual. Every color is a
 *  token, so the whole scene flips with the theme; motion is transform-only and
 *  the global reduced-motion guard stills it. No canvas, no network graph. */
export function Hero() {
  return (
    <section id="top" className="relative overflow-hidden">
      {/* Layered ambient depth, all from palette tokens */}
      <div
        aria-hidden
        className="so-drift pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br from-subtle via-app to-app opacity-80"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-32 -top-40 -z-10 h-[30rem] w-[30rem] rounded-pill bg-highlight/40 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -left-40 top-1/3 -z-10 h-96 w-96 rounded-pill bg-brand/10 blur-3xl"
      />

      <div className="mx-auto grid max-w-6xl gap-14 px-6 py-20 md:py-28 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:py-32">
        <div className="so-rise max-w-2xl">
          <div className="mb-8">
            <Logo size={44} />
          </div>
          <span className="inline-flex items-center gap-2 rounded-pill border border-border bg-surface/80 px-3.5 py-1.5 text-xs font-medium uppercase tracking-wide text-ink-muted backdrop-blur">
            <ShieldCheck width={14} height={14} className="text-brand" aria-hidden />
            Infrastructure Operations, in plain language
          </span>

          <h1 className="mt-7 text-balance font-display text-[2.55rem] font-semibold leading-[1.04] tracking-tight text-ink sm:text-5xl md:text-6xl lg:text-[4rem]">
            Run your own servers with the{' '}
            <span className="bg-gradient-to-r from-brand via-accent to-brand bg-clip-text text-transparent">
              confidence
            </span>{' '}
            of a whole platform team.
          </h1>

          <Text variant="body" tone="secondary" className="mt-6 max-w-xl text-lg">
            SlideOps helps you discover, configure, deploy, secure, verify, and monitor your own
            Linux servers over SSH. It orchestrates the tools you already run (Docker, systemd, apt,
            NGINX, Git), and never owns your infrastructure. You do.
          </Text>

          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Link to={signUpUrl}>
              <Button size="lg" className="group">
                Get started
                <ArrowRight
                  width={18}
                  height={18}
                  aria-hidden
                  className="transition-transform duration-fast ease-standard group-hover:translate-x-0.5"
                />
              </Button>
            </Link>
            <a href="#how">
              <Button size="lg" variant="secondary">
                See how it works
              </Button>
            </a>
          </div>

          <ul className="mt-9 flex flex-wrap items-center gap-x-5 gap-y-2.5">
            {assurances.map((line, index) => (
              <li key={line} className="flex items-center gap-2">
                {index > 0 ? (
                  <span aria-hidden className="hidden h-3.5 w-px bg-border sm:block" />
                ) : null}
                <ShieldCheck width={16} height={16} className="text-accent" aria-hidden />
                <Text as="span" variant="body-sm" tone="secondary">
                  {line}
                </Text>
              </li>
            ))}
          </ul>

          <div className="mt-9">
            <Text as="span" variant="caption" tone="secondary">
              Works across the major Linux families
            </Text>
            <ul className="mt-3 flex flex-wrap gap-2">
              {families.map((family) => (
                <li
                  key={family}
                  className="rounded-pill border border-border bg-surface/70 px-3 py-1 text-xs font-medium text-ink-muted"
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

/** A layered, gently floating product scene: a running Operation on a secured
 *  server, framed by a Project chip and a live metrics chip. All tokens. */
function HeroVisual() {
  return (
    <div className="so-rise-2 relative mx-auto w-full max-w-md lg:mr-0 lg:max-w-none">
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-6 -z-10 rounded-pill bg-gradient-to-br from-brand/15 via-highlight/10 to-highlight/25 blur-3xl"
      />

      <div className="so-float-slow relative">
        {/* Depth: an offset card edge behind, hinting at more servers */}
        <div
          aria-hidden
          className="absolute -right-3 -top-3 h-full w-full rounded-2xl border border-border bg-raised/60"
        />

        {/* Gradient hairline frame around the main card */}
        <div className="relative rounded-2xl bg-gradient-to-br from-brand/25 via-border to-highlight/30 p-px shadow-lg">
          <div className="rounded-2xl bg-surface p-5">
            {/* Server posture header */}
            <div className="flex items-center gap-3 rounded-xl border border-border bg-raised px-4 py-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-subtle text-brand">
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
                <span aria-hidden className="relative flex h-1.5 w-1.5">
                  <span className="so-pulse-soft absolute inline-flex h-full w-full rounded-pill bg-success" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-pill bg-success" />
                </span>
                Hardened
              </span>
            </div>

            {/* Live operation panel */}
            <div className="mt-4 rounded-xl border border-border bg-app p-4">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-2">
                  <Terminal width={15} height={15} className="text-accent" aria-hidden />
                  <Text as="span" variant="caption" tone="secondary">
                    Operation, executing
                  </Text>
                </span>
                <Text as="span" variant="caption" tone="secondary">
                  7 of 9
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
                <li className="flex items-center gap-2 text-ink">
                  <span aria-hidden className="text-accent">
                    &gt;
                  </span>
                  start service, 2 vCPU, 4 GB
                  <span aria-hidden className="so-blink -ml-1 inline-block h-3.5 w-1.5 bg-accent" />
                </li>
              </ul>

              {/* Progress track */}
              <div className="mt-4 h-1.5 overflow-hidden rounded-pill bg-border">
                <div className="h-full w-[76%] rounded-pill bg-gradient-to-r from-brand to-accent" />
              </div>

              <div className="mt-4 flex items-center gap-2">
                <span className="inline-flex items-center rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-brand-fg">
                  Approve
                </span>
                <span className="inline-flex items-center rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-ink-muted">
                  Review plan
                </span>
              </div>
            </div>

            {/* Verification result */}
            <div className="mt-4 flex items-center gap-3 rounded-xl border border-border bg-raised px-4 py-3">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-pill bg-subtle text-success">
                <Check width={16} height={16} aria-hidden />
              </span>
              <Text as="span" variant="body-sm">
                Verified and recorded. Rollback ready if a check fails.
              </Text>
            </div>
          </div>
        </div>

        {/* Floating Project chip */}
        <div className="so-float so-float-delay absolute -left-6 -top-6 hidden items-center gap-2.5 rounded-xl border border-border bg-surface px-3.5 py-2.5 shadow-md sm:flex">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-subtle text-brand">
            <FolderKanban width={16} height={16} aria-hidden />
          </span>
          <div>
            <Text as="span" variant="body-sm" className="block font-semibold leading-tight">
              storefront
            </Text>
            <span className="mt-1 flex items-center gap-1.5">
              <GitBranch width={11} height={11} className="text-accent" aria-hidden />
              <Text as="span" variant="caption" tone="secondary">
                pull deploy
              </Text>
            </span>
          </div>
        </div>

        {/* Floating metrics chip */}
        <div className="so-float absolute -bottom-6 -right-5 hidden w-44 flex-col gap-2 rounded-xl border border-border bg-surface px-4 py-3 shadow-md sm:flex">
          <span className="flex items-center gap-2">
            <Cpu width={14} height={14} className="text-accent" aria-hidden />
            <Text as="span" variant="caption" tone="secondary">
              Live usage, capped
            </Text>
          </span>
          <span>
            <span className="flex items-center justify-between">
              <Text as="span" variant="caption" tone="secondary">
                CPU
              </Text>
              <Text as="span" variant="caption" tone="secondary">
                1.4 / 2.0 vCPU
              </Text>
            </span>
            <span className="mt-1 block h-1.5 overflow-hidden rounded-pill bg-border">
              <span className="block h-full w-[70%] rounded-pill bg-brand" />
            </span>
          </span>
          <span>
            <span className="flex items-center justify-between">
              <Text as="span" variant="caption" tone="secondary">
                Memory
              </Text>
              <Text as="span" variant="caption" tone="secondary">
                2.6 / 4 GB
              </Text>
            </span>
            <span className="mt-1 block h-1.5 overflow-hidden rounded-pill bg-border">
              <span className="block h-full w-[65%] rounded-pill bg-accent" />
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}
