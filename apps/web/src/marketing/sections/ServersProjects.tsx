import { motion } from 'framer-motion';
import {
  Container,
  Database,
  FolderKanban,
  GitBranch,
  Gauge,
  KeyRound,
  ListChecks,
  Lock,
  RefreshCw,
  Server,
  ShieldCheck,
  Users,
  Waypoints,
  Wifi,
  type LucideIcon,
} from '@slideops/icons';
import { Glow, Grain, Reveal, WordReveal, useReducedMotion } from '../motion';

const headline = 'A secured server, and the Projects that run on it';

/**
 * Warm the closing word of the headline into a peach ember as it lands, matching
 * the hero and globe beats. The primitive stays copy-agnostic; this holds the
 * section's own emphasis, matched on the leading word so punctuation still lands.
 */
function warmWord(word: string): string | undefined {
  if (word.startsWith('Projects')) return 'so-hero-word-cognac';
  return undefined;
}

/** One step in a level, named as an outcome with a plain-language line. */
interface Step {
  icon: LucideIcon;
  title: string;
  body: string;
}

/** Level one: connect a server, look before touching, and secure it with no root. */
const serverSteps: Step[] = [
  {
    icon: Wifi,
    title: 'Connect over SSH',
    body: 'Reach a Linux server you own over SSH. There is no agent to install and nothing to hand over.',
  },
  {
    icon: ListChecks,
    title: 'Run a quick check',
    body: 'A read-only look reads the real state of the server before anything is changed, so you start from facts.',
  },
  {
    icon: Users,
    title: 'Secure with no root',
    body: 'Add a non-root administrator, harden SSH so root cannot sign in, then SlideOps switches to that account for good.',
  },
];

/** Level two: create a Project, give it servers and a stack, deploy, and watch. */
const projectSteps: Step[] = [
  {
    icon: FolderKanban,
    title: 'Create a Project and assign servers',
    body: 'A Project groups the work. Assign it one or more secured servers to run on, sharing them under hard limits.',
  },
  {
    icon: Container,
    title: 'Install only the Plugins it needs',
    body: 'Each Project installs only its own stack from the marketplace, so nothing carries weight it never uses.',
  },
  {
    icon: GitBranch,
    title: 'Connect GitHub and deploy',
    body: 'Deploy resource-limited Services straight from a GitHub repository, then monitor CPU, memory, disk, and health.',
  },
];

/** A short marketplace stack an example Project carries, drawn as small chips. */
interface StackChip {
  icon: LucideIcon;
  label: string;
}

/** One example Project sitting on the server, with the stack it installed. */
interface ProjectExample {
  name: string;
  stack: StackChip[];
}

const projectExamples: ProjectExample[] = [
  {
    name: 'storefront',
    stack: [
      { icon: Container, label: 'Containers' },
      { icon: Waypoints, label: 'Reverse proxy' },
      { icon: Lock, label: 'HTTPS' },
    ],
  },
  {
    name: 'api',
    stack: [
      { icon: Container, label: 'Containers' },
      { icon: GitBranch, label: 'GitHub deploy' },
      { icon: Gauge, label: 'Monitoring' },
    ],
  },
  {
    name: 'archive',
    stack: [
      { icon: Database, label: 'Backups' },
      { icon: RefreshCw, label: 'Auto updates' },
    ],
  },
];

/** The security badges the secured server carries at its base. */
const serverBadges: { icon: LucideIcon; label: string }[] = [
  { icon: KeyRound, label: 'Key-only SSH' },
  { icon: Users, label: 'Non-root admin' },
  { icon: ShieldCheck, label: 'Hardened' },
];

/** One example Project card, carrying its own installed stack as chips. */
function ProjectCard({ project, index }: { project: ProjectExample; index: number }) {
  return (
    <Reveal kind="slide" direction="up" delay={0.15 + index * 0.08} className="h-full">
      <article className="flex h-full flex-col rounded-xl border border-[color:var(--so-hero-hairline)] bg-[var(--so-hero-panel)] p-4">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-[color:var(--so-marketing-ink)] text-[color:var(--so-peach)]">
            <FolderKanban width={15} height={15} aria-hidden />
          </span>
          <span className="font-mono text-sm text-[color:var(--so-hero-ink)]">{project.name}</span>
        </div>
        <ul className="mt-3 flex flex-col gap-1.5">
          {project.stack.map(({ icon: Icon, label }) => (
            <li
              key={label}
              className="flex items-center gap-2 text-xs text-[color:var(--so-hero-ink-soft)]"
            >
              <Icon width={13} height={13} className="text-[color:var(--so-peach)]" aria-hidden />
              {label}
            </li>
          ))}
        </ul>
      </article>
    </Reveal>
  );
}

/**
 * The three connectors that tie the Projects to the secured server beneath them.
 * They read as light rising from the server up into each Project. On scroll they
 * draw upward from the server once, growing from a zero to a full height with a
 * transform only (no layout), and under reduced motion they render already drawn.
 */
function Connectors() {
  const reduced = useReducedMotion();
  return (
    <div aria-hidden className="grid grid-cols-3 gap-4 px-2">
      {projectExamples.map((project, index) => (
        <div key={project.name} className="flex h-10 justify-center">
          <motion.span
            className="block w-px"
            style={{
              transformOrigin: 'bottom',
              background:
                'linear-gradient(to top, var(--so-cognac) 0%, var(--so-peach) 55%, transparent 100%)',
              willChange: 'transform',
              height: '100%',
              ...(reduced ? { transform: 'scaleY(1)' } : {}),
            }}
            {...(reduced
              ? {}
              : {
                  initial: { scaleY: 0, opacity: 0 },
                  whileInView: { scaleY: 1, opacity: 1 },
                  viewport: { once: true, margin: '0px 0px -12% 0px' },
                  transition: {
                    duration: 0.42,
                    ease: [0.16, 1, 0.3, 1],
                    delay: 0.3 + index * 0.08,
                  },
                })}
          />
        </div>
      ))}
    </div>
  );
}

/**
 * The living two-level diagram: three example Projects sit above a single secured
 * server, connectors rising from the server into each Project as the beat scrolls
 * into view. It makes the model legible at a glance: one server carries many
 * Projects, and each Project carries only its own stack.
 */
function TwoLevelDiagram() {
  return (
    <figure className="relative mx-auto w-full max-w-xl">
      <Reveal kind="fade" className="mb-3 flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-[color:var(--so-hero-ink-faint)]">
          Level 2, Projects
        </span>
        <span className="text-xs text-[color:var(--so-hero-ink-faint)]">
          Each carries only its stack
        </span>
      </Reveal>

      <div className="grid grid-cols-3 gap-4">
        {projectExamples.map((project, index) => (
          <ProjectCard key={project.name} project={project} index={index} />
        ))}
      </div>

      <Connectors />

      <Reveal kind="slide" direction="up" delay={0.1}>
        <div className="rounded-xl border border-[color:var(--so-cognac)] bg-[var(--so-hero-panel)] p-5">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wide text-[color:var(--so-hero-ink-faint)]">
              Level 1, Server
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-md bg-[color:var(--so-marketing-ink)] text-[color:var(--so-peach)]">
              <Server width={22} height={22} aria-hidden />
            </span>
            <div>
              <p className="font-medium text-[color:var(--so-hero-ink)]">Secured server</p>
              <p className="text-sm text-[color:var(--so-hero-ink-soft)]">
                Reached over SSH, operated as a non-root administrator
              </p>
            </div>
          </div>
          <ul className="mt-4 flex flex-wrap gap-2">
            {serverBadges.map(({ icon: Icon, label }) => (
              <li
                key={label}
                className="inline-flex items-center gap-1.5 rounded-pill border border-[color:var(--so-hero-hairline)] bg-[color:var(--so-marketing-ink)] px-2.5 py-1 text-xs text-[color:var(--so-hero-ink-soft)]"
              >
                <Icon width={12} height={12} className="text-[color:var(--so-peach)]" aria-hidden />
                {label}
              </li>
            ))}
          </ul>
        </div>
      </Reveal>
    </figure>
  );
}

/** One level's ordered step list, numbered so the flow reads top to bottom. */
function StepList({ title, steps }: { title: string; steps: Step[] }) {
  return (
    <div>
      <Reveal kind="fade">
        <p className="text-sm font-semibold text-[color:var(--so-peach)]">{title}</p>
      </Reveal>
      <ol className="mt-5 flex flex-col gap-5">
        {steps.map(({ icon: Icon, title: stepTitle, body }, index) => (
          <Reveal as="li" kind="slide" direction="up" delay={index * 0.06} key={stepTitle}>
            <div className="flex gap-4">
              <span className="relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-[color:var(--so-hero-hairline)] bg-[var(--so-hero-panel)] text-[color:var(--so-peach)]">
                <Icon width={18} height={18} aria-hidden />
                <span className="absolute -right-1.5 -top-1.5 inline-flex h-5 w-5 items-center justify-center rounded-pill bg-[color:var(--so-cognac)] text-[10px] font-semibold text-[color:var(--so-neutral-50)]">
                  {index + 1}
                </span>
              </span>
              <div className="min-w-0">
                <p className="font-medium text-[color:var(--so-hero-ink)]">{stepTitle}</p>
                <p className="mt-1 text-sm leading-relaxed text-[color:var(--so-hero-ink-soft)]">
                  {body}
                </p>
              </div>
            </div>
          </Reveal>
        ))}
      </ol>
    </div>
  );
}

/**
 * The Servers-then-Projects beat, on the warm-dark hero-world so the two-level
 * diagram reads as a deliberate dark beat between the light Capabilities and the
 * light audience sections. It shows the whole model: first a server is connected
 * and secured with no root, then Projects are created on it, each installing only
 * its own stack and deploying resource-limited Services from GitHub. A living
 * diagram carries the shape (Projects sitting on one secured server, connectors
 * rising as it scrolls in), and two ordered step lists carry the detail. Calm and
 * legible, and fully static under reduced motion.
 */
export function ServersProjects() {
  return (
    <section id="servers-projects" className="so-hero-world relative isolate overflow-hidden">
      {/* Ambient warmth behind the whole beat, all decorative. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <Glow color="ember" size="42rem" x="84%" y="12%" pulse />
        <Glow color="warm" size="38rem" x="12%" y="80%" pulse />
        <Grain style={{ position: 'absolute' }} />
      </div>

      <div className="mx-auto max-w-6xl px-6 py-20 md:py-28">
        <div className="max-w-2xl">
          <Reveal kind="fade">
            <span className="inline-flex items-center gap-2 rounded-pill border border-[color:var(--so-hero-hairline)] bg-[var(--so-hero-panel)] px-3 py-1 text-xs font-medium uppercase tracking-wide text-[color:var(--so-hero-ink-faint)]">
              Servers, then Projects
            </span>
          </Reveal>

          <WordReveal
            as="h2"
            text={headline}
            delay={0.1}
            stagger={0.07}
            wordClassName={warmWord}
            className="mt-6 font-display text-4xl font-semibold tracking-tight text-[color:var(--so-hero-ink)] md:text-5xl"
          />

          <Reveal kind="fade" delay={0.25}>
            <p className="mt-6 text-lg leading-relaxed text-[color:var(--so-hero-ink-soft)]">
              You work in two levels. First you connect a server and secure it, so SlideOps never
              operates as root. Then you run Projects on it, each installing only the stack it needs
              and deploying resource-limited Services, so many Projects share one server without ever
              fighting for it.
            </p>
          </Reveal>
        </div>

        <div className="mt-14 grid items-start gap-12 lg:grid-cols-[1fr_minmax(0,26rem)] lg:gap-16">
          <div className="grid gap-12 sm:grid-cols-2">
            <StepList title="Secure the server" steps={serverSteps} />
            <StepList title="Run Projects on it" steps={projectSteps} />
          </div>

          <div className="order-first lg:order-none">
            <TwoLevelDiagram />
          </div>
        </div>
      </div>
    </section>
  );
}
