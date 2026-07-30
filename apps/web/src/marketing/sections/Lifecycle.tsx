import { Text } from '@slideops/design-system';
import { CheckCircle2, Search, ShieldCheck } from '@slideops/icons';
import { useReveal } from '../useReveal';

interface Step {
  name: string;
  note: string;
}

const steps: Step[] = [
  { name: 'Discover', note: 'Read the server as it is.' },
  { name: 'Assess', note: 'Judge what is safe.' },
  { name: 'Recommend', note: 'Propose the outcome.' },
  { name: 'Plan', note: 'Lay out exact steps.' },
  { name: 'Approve', note: 'You give the go.' },
  { name: 'Execute', note: 'Carry out the plan.' },
  { name: 'Verify', note: 'Prove it worked.' },
  { name: 'Observe', note: 'Watch the result.' },
  { name: 'Record', note: 'Write it to History.' },
];

const rules = [
  {
    icon: Search,
    title: 'Discovery only observes',
    body: 'The read-only quick check reads your server and changes nothing, so you can look before you touch.',
  },
  {
    icon: CheckCircle2,
    title: 'Approval is your gate',
    body: 'Nothing executes until you approve the plan. The decision to change anything is always yours.',
  },
  {
    icon: ShieldCheck,
    title: 'Verification always follows',
    body: 'Every execution is verified, and a change that would cut you off is caught and rolled back automatically.',
  },
];

/** The Capability lifecycle every change follows, as a clean, legible stepper. */
export function Lifecycle() {
  const { ref, shown } = useReveal<HTMLDivElement>();
  return (
    <section id="lifecycle" className="border-y border-border bg-surface">
      <div className="mx-auto max-w-6xl px-6 py-20 md:py-24">
        <div className="so-rise max-w-2xl">
          <Text variant="caption" tone="accent">
            The lifecycle
          </Text>
          <Text as="h2" variant="h1" className="mt-3">
            Every change follows one lifecycle, end to end
          </Text>
          <Text variant="body" tone="secondary" className="mt-5">
            From a read-only look to a recorded result, each Operation moves through the same nine
            steps. The path never skips, so intent, approval, and proof stay in the same order every
            time.
          </Text>
        </div>

        <div
          ref={ref}
          className={`mt-12 grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-9 so-reveal${shown ? ' so-reveal-in' : ''}`}
        >
          {steps.map((step, index) => (
            <div
              key={step.name}
              className="so-stagger group relative flex flex-col rounded-lg border border-border bg-app p-4 transition-transform duration-base ease-standard hover:-translate-y-0.5"
            >
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-pill bg-subtle text-xs font-semibold text-brand">
                {index + 1}
              </span>
              <Text as="span" variant="body-sm" className="mt-3 block font-semibold">
                {step.name}
              </Text>
              <Text
                as="span"
                variant="caption"
                tone="secondary"
                className="mt-1 block normal-case tracking-normal"
              >
                {step.note}
              </Text>
            </div>
          ))}
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {rules.map(({ icon: Icon, title, body }) => (
            <article
              key={title}
              className="flex items-start gap-3 rounded-lg border border-border bg-app p-5"
            >
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-subtle text-brand">
                <Icon width={20} height={20} aria-hidden />
              </span>
              <div className="min-w-0">
                <Text variant="h4" className="text-base">
                  {title}
                </Text>
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
