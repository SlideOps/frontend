import { Text } from '@slideops/design-system';
import {
  Cpu,
  Home,
  Layers,
  Rocket,
  Terminal,
  Users,
  type LucideIcon,
} from '@slideops/icons';

interface Audience {
  icon: LucideIcon;
  title: string;
  body: string;
}

const audiences: Audience[] = [
  {
    icon: Terminal,
    title: 'Developers',
    body: 'Ship your own app to your own server without memorizing a stack of shell commands.',
  },
  {
    icon: Layers,
    title: 'Platform engineers',
    body: 'A consistent, verified way to run the same outcomes across a fleet of different distributions.',
  },
  {
    icon: Home,
    title: 'Self hosters',
    body: 'Run the services you rely on, hardened and backed up, with a clear record of every change.',
  },
  {
    icon: Cpu,
    title: 'Home labs',
    body: 'Experiment freely on your own servers, with a quick check that never changes anything until you say so.',
  },
  {
    icon: Rocket,
    title: 'Startups',
    body: 'Stand up secure infrastructure early, and understand exactly what is running as you grow.',
  },
  {
    icon: Users,
    title: 'Teams',
    body: 'Share one clear lifecycle so every Operator plans, approves, and verifies work the same way.',
  },
];

/** Who SlideOps is for, from a single developer to a whole team. */
export function Audience() {
  return (
    <section id="who" className="border-y border-border bg-surface">
      <div className="mx-auto max-w-6xl px-6 py-20 md:py-24">
        <div className="so-rise max-w-2xl">
          <Text variant="caption" tone="accent">
            Who it is for
          </Text>
          <Text as="h2" variant="h1" className="mt-3">
            Built for anyone who runs their own Linux
          </Text>
          <Text variant="body" tone="secondary" className="mt-5">
            From a single machine to a fleet, SlideOps meets you where you are and keeps you in
            control the whole way.
          </Text>
        </div>

        <div className="so-rise-2 mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {audiences.map(({ icon: Icon, title, body }) => (
            <article key={title} className="flex items-start gap-4 rounded-lg border border-border bg-app p-6">
              <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-subtle text-brand">
                <Icon width={22} height={22} aria-hidden />
              </span>
              <div className="min-w-0">
                <Text variant="h4">{title}</Text>
                <Text variant="body-sm" tone="secondary" className="mt-1">
                  {body}
                </Text>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
