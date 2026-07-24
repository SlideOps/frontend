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
import { Glow, Grain, Reveal } from '../motion';

interface AudienceEntry {
  icon: LucideIcon;
  title: string;
  body: string;
}

const audiences: AudienceEntry[] = [
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

/** Where the glowing pins rest over the soft map, as CSS anchors. */
const pins: { x: string; y: string }[] = [
  { x: '18%', y: '30%' },
  { x: '44%', y: '52%' },
  { x: '68%', y: '26%' },
  { x: '82%', y: '62%' },
  { x: '32%', y: '74%' },
  { x: '58%', y: '84%' },
];

/**
 * A soft, light-touch pin map behind the grid: a faint dotted field built from a
 * palette-tinted radial pattern, with a handful of warm pins that gently pulse
 * where Operators run. It evokes the video's use-cases map without shipping a
 * heavy asset: the dots are a CSS gradient tinted from a token, and each pin is a
 * small palette glow with a warm core. It is decorative and hidden from assistive
 * technology, and it is fully still under reduced motion (the pin pulse is
 * dropped by the Glow primitive, and the dotted field never animates).
 */
function PinMap() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      {/* The faint dotted field, tinted from the cognac token and held low. */}
      <div
        className="absolute inset-0 opacity-[0.10]"
        style={{
          backgroundImage: 'radial-gradient(var(--so-cognac) 1px, transparent 1.4px)',
          backgroundSize: '26px 26px',
          maskImage: 'radial-gradient(ellipse 80% 70% at 50% 45%, black, transparent 78%)',
          WebkitMaskImage: 'radial-gradient(ellipse 80% 70% at 50% 45%, black, transparent 78%)',
        }}
      />
      {pins.map((pin) => (
        <span key={`${pin.x}-${pin.y}`}>
          <Glow color="ember" size="7rem" x={pin.x} y={pin.y} pulse />
          <span
            className="absolute h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-pill"
            style={{
              left: pin.x,
              top: pin.y,
              backgroundColor: 'var(--so-peach)',
              boxShadow: '0 0 10px var(--so-glow-ember)',
            }}
          />
        </span>
      ))}
    </div>
  );
}

/**
 * Who SlideOps is for, on the warm-light paper-world. From a single developer to
 * a whole team, the same audiences the beat has always named, now presented as an
 * inviting grid over a soft pin map so it reads as the video's use-cases map in
 * our palette. Each card reveals in a gentle wave as the section scrolls into
 * view. Truthful throughout, and fully composed and still under reduced motion.
 */
export function Audience() {
  return (
    <section id="who" className="so-paper-world relative isolate overflow-hidden">
      {/* A little ambient warmth and the tactile grain, decorative and behind copy. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <Glow color="ember" size="34rem" x="92%" y="4%" />
        <Glow color="rose" size="30rem" x="0%" y="98%" />
        <Grain style={{ position: 'absolute' }} />
      </div>
      <PinMap />

      <div className="mx-auto max-w-6xl px-6 py-20 md:py-24">
        <Reveal className="max-w-2xl">
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
        </Reveal>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {audiences.map(({ icon: Icon, title, body }, index) => (
            <Reveal key={title} delay={index * 0.06} className="h-full">
              <article className="flex h-full items-start gap-4 rounded-lg border border-border bg-surface p-6">
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
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
