import { Text } from '@slideops/design-system';
import { ListChecks, ShieldCheck, Sparkles, type LucideIcon } from '@slideops/icons';
import { Glow, Grain, Reveal } from '../motion';

interface Pillar {
  icon: LucideIcon;
  title: string;
  body: string;
}

const pillars: Pillar[] = [
  {
    icon: Sparkles,
    title: 'Infrastructure should be understandable',
    body: 'You describe the outcome you want, not the commands to type. SlideOps reads your server in plain language and explains every step as you go, so the system teaches as you work.',
  },
  {
    icon: ShieldCheck,
    title: 'Operators stay in control',
    body: 'Nothing runs until you approve a plan. SlideOps never operates as root, your servers stay yours, your credentials are encrypted, and you are never locked out of your own machine.',
  },
  {
    icon: ListChecks,
    title: 'Verification and rollback build confidence',
    body: 'Every change is proven before it counts. If a check does not pass, the change is rolled back automatically, so confidence is the result rather than a hope.',
  },
];

const lifecycle = [
  'Discover',
  'Assess',
  'Recommend',
  'Plan',
  'Approve',
  'Execute',
  'Verify',
  'Observe',
  'Record',
];

/** The story from the blueprint: understandable, in control, confidence, and the lifecycle. */
export function Story() {
  return (
    <section id="how" className="so-paper-world relative isolate overflow-hidden">
      {/* The fold opens into this warm-light paper. A little ambient warmth and
          the tactile grain carry the inspiration still into the section. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <Glow color="ember" size="34rem" x="88%" y="-8%" />
        <Glow color="rose" size="28rem" x="4%" y="108%" />
        <Grain style={{ position: 'absolute' }} />
      </div>

      <div className="mx-auto max-w-6xl px-6 py-20 md:py-24">
        <Reveal className="max-w-2xl">
          <Text variant="caption" tone="accent">
            Why SlideOps
          </Text>
          <Text as="h2" variant="h1" className="mt-3">
            One clear path from intent to a verified outcome
          </Text>
          <Text variant="body" tone="secondary" className="mt-5">
            You work in two levels: first secure your servers, then run Projects on them, installing
            only the stack each Project needs. Underneath, SlideOps separates the Capability you
            intend from the Provider that carries it out on your platform, so the same goal works
            across different systems. Three ideas hold it together.
          </Text>
        </Reveal>

        <div className="so-rise-2 mt-12 grid gap-6 md:grid-cols-3">
          {pillars.map(({ icon: Icon, title, body }) => (
            <article key={title} className="rounded-lg border border-border bg-app p-6">
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

        <div className="so-rise-3 mt-14">
          <Text variant="caption" tone="secondary">
            Every Operation follows one lifecycle
          </Text>
          <ol className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-3">
            {lifecycle.map((step, index) => (
              <li key={step} className="flex items-center gap-2">
                <span className="inline-flex items-center gap-2 rounded-pill border border-border bg-app px-3 py-1.5">
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-pill bg-subtle text-xs font-semibold text-brand">
                    {index + 1}
                  </span>
                  <Text as="span" variant="body-sm">
                    {step}
                  </Text>
                </span>
                {index < lifecycle.length - 1 ? (
                  <span aria-hidden className="text-ink-muted">
                    &rsaquo;
                  </span>
                ) : null}
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
