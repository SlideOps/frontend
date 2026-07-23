import { Button, Text, useTheme } from '@slideops/design-system';
import {
  ArrowRight,
  Gauge,
  Layers,
  ListChecks,
  Logo,
  Moon,
  Network,
  Shield,
  ShieldCheck,
  Sun,
  type LucideIcon,
} from '@slideops/icons';

interface Capability {
  icon: LucideIcon;
  title: string;
  body: string;
}

const capabilities: Capability[] = [
  {
    icon: Network,
    title: 'Discover',
    body: 'Connect a Node over SSH and read exactly what is there. Discovery only observes, it never changes anything.',
  },
  {
    icon: Layers,
    title: 'Plan',
    body: 'See a clear plan with the reasons behind it, the risks, and the rollback notes, before a single change is made.',
  },
  {
    icon: ShieldCheck,
    title: 'Approve',
    body: 'Nothing runs until you approve it. Approval is a real gate, held by the Operator who owns the Node.',
  },
  {
    icon: Gauge,
    title: 'Execute',
    body: 'Watch execution stream live, step by step, with a terminal view and a timeline you can follow.',
  },
  {
    icon: ListChecks,
    title: 'Verify',
    body: 'Every Operation proves its outcome and attaches the evidence. An execution without verification is incomplete.',
  },
  {
    icon: Shield,
    title: 'Observe',
    body: 'Monitoring keeps watching after the work is done, and History records every Operation for later.',
  },
];

function ThemeToggle() {
  const { resolved, toggle } = useTheme();
  const isDark = resolved === 'dark';
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      className="inline-flex h-10 w-10 items-center justify-center rounded-md text-ink-muted transition-colors duration-fast ease-standard hover:bg-subtle hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
    >
      {isDark ? <Sun width={18} height={18} aria-hidden /> : <Moon width={18} height={18} aria-hidden />}
    </button>
  );
}

export function App() {
  return (
    <div className="min-h-screen bg-app text-ink">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <Logo size={30} />
        <div className="flex items-center gap-2">
          <a
            href="#capabilities"
            className="hidden rounded-md px-3 py-2 text-sm font-medium text-ink-muted transition-colors duration-fast ease-standard hover:text-ink sm:inline-flex"
          >
            Capabilities
          </a>
          <ThemeToggle />
          <Button size="sm">Sign up</Button>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden">
          <div
            aria-hidden
            className="so-drift pointer-events-none absolute inset-0 -z-10 opacity-70"
            style={{
              background:
                'radial-gradient(60% 55% at 20% 20%, var(--color-bg-subtle), transparent), radial-gradient(50% 50% at 85% 15%, var(--color-highlight), transparent)',
            }}
          />
          <div className="mx-auto max-w-6xl px-6 py-24 md:py-32">
            <div className="so-rise max-w-3xl">
              <span className="inline-flex items-center gap-2 rounded-pill border border-border bg-surface px-3 py-1 text-xs font-medium uppercase tracking-wide text-ink-muted">
                Infrastructure Operations Platform
              </span>
              <Text as="h1" variant="display" className="mt-6">
                Knowledge becomes Capabilities. Capabilities create Confidence.
              </Text>
              <Text variant="body" tone="secondary" className="mt-6 max-w-2xl text-lg">
                SlideOps helps Operators discover, configure, deploy, secure, verify, and monitor
                their own infrastructure over SSH. It orchestrates and explains the tools you
                already run. It never owns your infrastructure. You do.
              </Text>
              <div className="mt-9 flex flex-wrap items-center gap-3">
                <Button size="lg">
                  Get started
                  <ArrowRight width={18} height={18} aria-hidden />
                </Button>
                <Button size="lg" variant="secondary" onClick={() => undefined}>
                  See how it works
                </Button>
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-border bg-surface">
          <div className="mx-auto grid max-w-6xl gap-10 px-6 py-20 md:grid-cols-[1.1fr_1fr] md:items-center">
            <div className="so-rise">
              <Text variant="caption" tone="accent">
                What it is
              </Text>
              <Text as="h2" variant="h1" className="mt-3">
                One clear path from intent to a verified outcome
              </Text>
              <Text variant="body" tone="secondary" className="mt-5 max-w-xl">
                You describe what you want, not the commands to type. SlideOps separates the
                Capability you intend from the Provider that carries it out on your platform, so the
                same goal works across different systems. Every Operation follows one lifecycle:
                discover, assess, recommend, plan, approve, execute, verify, observe, record.
              </Text>
            </div>
            <ul className="so-rise-2 grid gap-3">
              {['Your nodes stay yours, always', 'Approval before any change', 'Verification after every execution', 'Plain-language guidance on every control'].map(
                (line) => (
                  <li
                    key={line}
                    className="flex items-center gap-3 rounded-md border border-border bg-app px-4 py-3"
                  >
                    <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-pill bg-subtle text-brand">
                      <ShieldCheck width={18} height={18} aria-hidden />
                    </span>
                    <Text variant="body-sm">{line}</Text>
                  </li>
                ),
              )}
            </ul>
          </div>
        </section>

        <section id="capabilities" className="mx-auto max-w-6xl px-6 py-20">
          <div className="so-rise max-w-2xl">
            <Text variant="caption" tone="accent">
              Capabilities
            </Text>
            <Text as="h2" variant="h1" className="mt-3">
              Searchable by outcome, never by tool
            </Text>
            <Text variant="body" tone="secondary" className="mt-5">
              A teaser of the lifecycle every Capability runs through. Each step is explained where
              you stand, so the product teaches as you work.
            </Text>
          </div>
          <div className="so-rise-2 mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {capabilities.map(({ icon: Icon, title, body }) => (
              <article
                key={title}
                className="group rounded-lg border border-border bg-surface p-6 transition-shadow duration-base ease-standard hover:shadow-md"
              >
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-md bg-subtle text-brand">
                  <Icon width={22} height={22} aria-hidden />
                </span>
                <Text variant="h4" className="mt-4">
                  {title}
                </Text>
                <Text variant="body-sm" tone="secondary" className="mt-2">
                  {body}
                </Text>
              </article>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-border bg-surface">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-6 py-12 md:flex-row md:items-center">
          <div>
            <Logo size={26} />
            <Text variant="body-sm" tone="secondary" className="mt-3 max-w-md">
              Knowledge becomes Capabilities. Capabilities create Confidence.
            </Text>
          </div>
          <Text variant="body-sm" tone="secondary">
            Built for Operators who stay in control.
          </Text>
        </div>
      </footer>
    </div>
  );
}
