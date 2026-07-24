import { Text } from '@slideops/design-system';
import { motion, useScroll, useTransform, type MotionStyle, type MotionValue } from 'framer-motion';
import { useRef } from 'react';
import { Glow, Grain, Reveal, useReducedMotion } from '../motion';

/** One stage in the operational lifecycle: its name and one plain-language line. */
interface Stage {
  name: string;
  copy: string;
}

/**
 * The nine stages every Operation moves through, in order. The copy is true to
 * how SlideOps works: discovery only observes, approval is the operator's gate,
 * and verification always follows execution.
 */
const stages: Stage[] = [
  { name: 'Discover', copy: 'SlideOps reads your Node over SSH to learn its real state. Discovery only observes; it never changes a thing.' },
  { name: 'Assess', copy: 'It weighs what it found against the outcome you want, and names the gap between the two.' },
  { name: 'Recommend', copy: 'You get a clear recommendation in plain language, with the trade-offs spelled out, not buried.' },
  { name: 'Plan', copy: 'Every step is written out in advance as an ordered, readable plan you can inspect before anything moves.' },
  { name: 'Approve', copy: 'Nothing runs until you say so. Approval is your gate, and it is always yours to give or withhold.' },
  { name: 'Execute', copy: 'SlideOps carries out the approved plan through the right Provider for your platform, and never as root.' },
  { name: 'Verify', copy: 'Verification always follows execution. A change that cannot be proven does not count as done.' },
  { name: 'Observe', copy: 'It keeps watching after the change, so you see the real, living result rather than a hopeful guess.' },
  { name: 'Record', copy: 'Every Operation is written to History, so you always know what happened on your Nodes, and why.' },
];

/** Where the first and last stages light, leaving a little runway at each end. */
const FIRST_LIT = 0.06;
const LAST_LIT = 0.92;
/** How much scroll each stage takes to warm from dim to fully lit. */
const ACTIVATION_BAND = 0.09;

/** The scroll fraction at which stage `index` reaches its fully lit state. */
function litAt(index: number): number {
  return FIRST_LIT + (index / (stages.length - 1)) * (LAST_LIT - FIRST_LIT);
}

interface StageRowProps {
  index: number;
  stage: Stage;
  isLast: boolean;
  progress: MotionValue<number>;
  reduced: boolean;
}

/**
 * One stage on the spine: a node that warms as the flow reaches it and a copy
 * block that lifts from dim to fully legible with it. Each row owns its own
 * scroll-derived motion values, so the lighting stays cheap opacity and scale
 * work with no colour interpolation. Under reduced motion every value is pinned
 * to its lit state, so the whole lifecycle shows at once, composed and still.
 */
function StageRow({ index, stage, isLast, progress, reduced }: StageRowProps) {
  const litPoint = litAt(index);
  // The node warms as the flow arrives; the connecting segment then fills toward
  // the next node, so a warm signal appears to travel down the spine in order.
  const activation = useTransform(progress, [litPoint - ACTIVATION_BAND, litPoint], [0, 1]);
  const contentOpacity = useTransform(activation, [0, 1], [0.5, 1]);
  const segmentFill = useTransform(progress, [litPoint, litAt(index + 1)], [0, 1]);

  const litStyle: MotionStyle = reduced ? { opacity: 1 } : { opacity: activation };
  const copyStyle: MotionStyle = reduced ? { opacity: 1 } : { opacity: contentOpacity };
  const fillStyle: MotionStyle = reduced ? { scaleY: 1 } : { scaleY: segmentFill };

  return (
    <li className="relative grid grid-cols-[2.25rem_1fr] gap-x-5">
      {/* Marker column: the node dot, then the connecting segment filling down. */}
      <div className="flex flex-col items-center">
        <span className="relative mt-1 inline-flex h-5 w-5 items-center justify-center">
          {/* The resting node: a calm neutral ring on the paper. */}
          <span className="absolute inset-0 rounded-pill border-2 border-border bg-app" />
          {/* The lit node: a warm cognac disc with a soft peach halo, cross-faded
              in over the resting ring so there is no colour interpolation. */}
          <motion.span
            className="absolute inset-0 rounded-pill"
            style={{
              backgroundColor: 'var(--so-cognac)',
              border: '2px solid var(--so-peach)',
              boxShadow: '0 0 0 4px var(--so-glow-ember), 0 0 18px var(--so-glow-warm)',
              ...litStyle,
            }}
          />
        </span>
        {!isLast ? (
          <span className="relative my-1.5 w-0.5 flex-1 overflow-hidden rounded-pill bg-border">
            <motion.span
              className="absolute inset-0 origin-top rounded-pill"
              style={{
                background:
                  'linear-gradient(to bottom, var(--so-cognac), var(--so-peach))',
                ...fillStyle,
              }}
            />
          </span>
        ) : null}
      </div>

      {/* Copy column: the stage name, its ordinal, and one plain-language line. */}
      <motion.div className="pb-9" style={copyStyle}>
        <div className="flex items-baseline gap-3">
          <Text as="span" variant="caption" tone="accent" className="tabular-nums">
            {String(index + 1).padStart(2, '0')}
          </Text>
          <Text as="h3" variant="h4">
            {stage.name}
          </Text>
        </div>
        <Text variant="body-sm" tone="secondary" className="mt-1.5 max-w-prose">
          {stage.copy}
        </Text>
      </motion.div>
    </li>
  );
}

/**
 * The operational lifecycle as a flowing pipeline. The nine stages are laid out
 * as a connected vertical spine of nodes that light up in sequence as the
 * operator scrolls through the section: a warm signal travels down the path,
 * warming each node and its copy in order. It is the product's spine made
 * visible, kept calm and legible rather than busy.
 *
 * The lighting is scroll-progress driven (`useScroll` over the section), so it
 * costs only transform and opacity work while the section is on screen. Under a
 * reduce-motion preference every stage is shown in its lit, composed state at
 * once, the whole pipeline present and still. It sits on the warm-light paper
 * surface, part of the how-it-works flow the fold opens into.
 */
export function Lifecycle() {
  const reduced = useReducedMotion();
  const sectionRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start 0.85', 'end 0.35'],
  });

  return (
    <section className="so-paper-world relative isolate overflow-hidden">
      {/* Ambient warmth, decorative and behind the copy. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <Glow color="ember" size="30rem" x="90%" y="12%" />
        <Glow color="rose" size="26rem" x="2%" y="94%" />
        <Grain style={{ position: 'absolute' }} />
      </div>

      <div ref={sectionRef} className="mx-auto max-w-6xl px-6 py-20 md:py-24">
        <Reveal className="max-w-2xl">
          <Text variant="caption" tone="accent">
            How it works
          </Text>
          <Text as="h2" variant="h1" className="mt-3">
            The lifecycle, made visible
          </Text>
          <Text variant="body" tone="secondary" className="mt-5">
            Every Capability runs the same nine stages, in the same order, every time. SlideOps looks
            before it touches anything, you approve before a single change runs, and nothing is called
            done until it has been verified.
          </Text>
        </Reveal>

        <ol className="mt-14 max-w-3xl">
          {stages.map((stage, index) => (
            <StageRow
              key={stage.name}
              index={index}
              stage={stage}
              isLast={index === stages.length - 1}
              progress={scrollYProgress}
              reduced={reduced}
            />
          ))}
        </ol>
      </div>
    </section>
  );
}
