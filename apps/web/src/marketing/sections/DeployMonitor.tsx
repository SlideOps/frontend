import { Text } from '@slideops/design-system';
import {
  Activity,
  Bell,
  Cpu,
  GitBranch,
  HardDrive,
  HeartPulse,
  MemoryStick,
} from '@slideops/icons';
import { useReveal } from '../useReveal';

const deploySteps = [
  'Connect your own GitHub OAuth app, once.',
  'A Service with a repository source clones on its first deploy.',
  'On every redeploy it pulls the branch you name. No re-clone.',
];

const metrics = [
  { icon: Cpu, label: 'CPU', value: 'w-2/3' },
  { icon: MemoryStick, label: 'Memory', value: 'w-1/2' },
  { icon: HardDrive, label: 'Disk', value: 'w-1/3' },
];

/** Deploy from GitHub and watch everything: pull deploys, monitoring, and history. */
export function DeployMonitor() {
  const { ref, shown } = useReveal<HTMLDivElement>();
  return (
    <section id="deploy" className="border-y border-border bg-surface">
      <div className="mx-auto max-w-6xl px-6 py-20 md:py-24">
        <div className="so-rise max-w-2xl">
          <Text variant="caption" tone="accent">
            Deploy and monitor
          </Text>
          <Text as="h2" variant="h1" className="mt-3">
            Ship from GitHub, then watch it run
          </Text>
          <Text variant="body" tone="secondary" className="mt-5">
            Deploy Services straight from your repositories, and keep an eye on every one. SlideOps
            records CPU, memory, disk, and Service health on a schedule, and writes every Operation
            to a History you can read.
          </Text>
        </div>

        <div
          ref={ref}
          className={`mt-12 grid gap-6 lg:grid-cols-2 so-reveal${shown ? ' so-reveal-in' : ''}`}
        >
          {/* GitHub pull deploys */}
          <article className="so-stagger flex flex-col rounded-xl border border-border bg-app p-6 md:p-8">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-md bg-subtle text-brand">
                <GitBranch width={22} height={22} aria-hidden />
              </span>
              <Text variant="h3">GitHub pull deploys</Text>
            </div>
            <ol className="mt-6 flex flex-col gap-3">
              {deploySteps.map((step, index) => (
                <li key={step} className="flex items-start gap-3">
                  <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-pill bg-subtle text-xs font-semibold text-brand">
                    {index + 1}
                  </span>
                  <Text as="span" variant="body-sm" tone="secondary">
                    {step}
                  </Text>
                </li>
              ))}
            </ol>
            <div className="mt-6 rounded-lg border border-border bg-surface p-4 font-mono text-xs text-ink-muted">
              <span className="text-accent">git pull</span> origin{' '}
              <span className="text-brand">main</span>
            </div>
          </article>

          {/* Monitoring */}
          <article className="so-stagger flex flex-col rounded-xl border border-border bg-app p-6 md:p-8">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-md bg-subtle text-brand">
                <Activity width={22} height={22} aria-hidden />
              </span>
              <Text variant="h3">Monitoring and history</Text>
            </div>
            <div className="mt-6 flex flex-col gap-3">
              {metrics.map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex items-center gap-3">
                  <Icon width={16} height={16} className="text-accent" aria-hidden />
                  <Text as="span" variant="body-sm" className="w-16 shrink-0">
                    {label}
                  </Text>
                  <div className="h-2 flex-1 overflow-hidden rounded-pill bg-subtle">
                    <div className={`h-full rounded-pill bg-brand ${value}`} />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <div className="flex flex-1 items-center gap-2 rounded-lg border border-border bg-surface p-3">
                <HeartPulse width={16} height={16} className="text-success" aria-hidden />
                <Text as="span" variant="body-sm">
                  Service health, on a schedule
                </Text>
              </div>
              <div className="flex flex-1 items-center gap-2 rounded-lg border border-border bg-surface p-3">
                <Bell width={16} height={16} className="text-brand" aria-hidden />
                <Text as="span" variant="body-sm">
                  Notifications when it matters
                </Text>
              </div>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
