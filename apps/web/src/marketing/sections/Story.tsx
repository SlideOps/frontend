import { Text } from '@slideops/design-system';
import { ListChecks, ShieldCheck, Sparkles, type LucideIcon } from '@slideops/icons';
import { useReveal } from '../useReveal';

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

/** The story from the blueprint: understandable, in control, and confident by design. */
export function Story() {
  const { ref, shown } = useReveal<HTMLDivElement>();
  return (
    <section id="how" className="border-y border-border bg-surface">
      <div className="mx-auto max-w-6xl px-6 py-20 md:py-24">
        <div className="so-rise max-w-2xl">
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
        </div>

        <div
          ref={ref}
          className={`mt-12 grid gap-6 md:grid-cols-3 so-reveal${shown ? ' so-reveal-in' : ''}`}
        >
          {pillars.map(({ icon: Icon, title, body }) => (
            <article
              key={title}
              className="so-stagger group rounded-lg border border-border bg-app p-6 transition-shadow duration-base ease-standard hover:shadow-md"
            >
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-md bg-subtle text-brand transition-transform duration-base ease-standard group-hover:-translate-y-0.5">
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
      </div>
    </section>
  );
}
