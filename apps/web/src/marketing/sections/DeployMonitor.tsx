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

/*
 * The ways a workload gets onto a server.
 *
 * The site used to describe exactly one: deploying from GitHub. That is the
 * fullest option and not the only one, and the two it left out are the ones that
 * matter most to somebody who already has servers running. Adoption in
 * particular is the answer to "I have years of things on this box", and saying
 * nothing about it invites the conclusion that SlideOps only works on a clean
 * machine.
 */
const methods = [
  {
    name: 'From a repository',
    detail:
      'Clone a branch, build it, run it. Every redeploy pulls that branch, and SlideOps tells you when new commits are waiting. The only source it can rebuild from, so the only one where redeploy means "take the newest code".',
  },
  {
    name: 'From an image',
    detail:
      'Run an image that already exists. Nothing is built here, which suits anything published to a registry or built somewhere else.',
  },
  {
    name: 'Adopted',
    detail:
      'It was already running when SlideOps found it. Adopting changes nothing: not restarted, not rebuilt, not moved. SlideOps starts keeping a record, so a server with years of history joins without a migration.',
  },
];

function MethodGrid() {
  return (
    <div className="mt-10 grid gap-4 sm:grid-cols-3">
      {methods.map((method) => (
        <article key={method.name} className="rounded-lg border border-border bg-app p-5">
          <Text variant="body-sm" className="font-semibold">
            {method.name}
          </Text>
          <Text variant="body-sm" tone="secondary" className="mt-2 block">
            {method.detail}
          </Text>
        </article>
      ))}
    </div>
  );
}

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
            Three ways in, however your work already runs
          </Text>
          <Text variant="body" tone="secondary" className="mt-5">
            A Service comes from a repository, from an image, or from something already running on
            the server that SlideOps adopts as it stands. It runs as a container, a Compose stack,
            or a systemd service with no container at all. Whichever you pick, you get an address, a
            terminal, monitoring, and every Operation written to a History you can read.
          </Text>
        </div>

        <MethodGrid />

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
