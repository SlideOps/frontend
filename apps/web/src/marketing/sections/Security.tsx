import {
  CheckCircle2,
  KeyRound,
  ListChecks,
  Lock,
  Mark,
  RefreshCw,
  Shield,
  ShieldCheck,
  Users,
  type LucideIcon,
} from '@slideops/icons';
import { Glow, Grain, Reveal, WordReveal } from '../motion';

const headline = 'Hardened first, and never operated as root';

/**
 * Warm the closing word into a peach ember and the opening word into cognac as
 * the line lands, matching the hero and globe beats. The primitive stays
 * copy-agnostic; this holds the section's own emphasis, matched on the leading
 * word so trailing punctuation still resolves.
 */
function warmWord(word: string): string | undefined {
  if (word.startsWith('root')) return 'so-hero-word-peach';
  if (word.startsWith('Hardened')) return 'so-hero-word-cognac';
  return undefined;
}

/** One hardening or add-on outcome, named as a result with a plain-language line. */
interface SecurityItem {
  icon: LucideIcon;
  title: string;
  body: string;
}

/** Core hardening, applied the moment a server is connected. Built in, not added. */
const coreHardening: SecurityItem[] = [
  {
    icon: Lock,
    title: 'Secure SSH, root sign-in off',
    body: 'SSH is tightened and root can no longer sign in, so the front door is closed before anything else runs.',
  },
  {
    icon: Shield,
    title: 'The host firewall',
    body: 'The firewall is raised and only the ports you need stay open, so the server is not exposed by default.',
  },
  {
    icon: Users,
    title: 'A non-root administrator',
    body: 'A non-root administrator is created and SlideOps switches to it for good, so it never operates as root.',
  },
  {
    icon: RefreshCw,
    title: 'Package and system updates',
    body: 'Packages and the system are brought up to date, so a freshly connected server starts from a known, patched state.',
  },
];

/** The security marketplace add-ons, installed per Project when a server wants more. */
const securityAddOns: SecurityItem[] = [
  {
    icon: ShieldCheck,
    title: 'fail2ban',
    body: 'Watch for repeated failed sign-ins and ban the source automatically, so brute force gets nowhere.',
  },
  {
    icon: RefreshCw,
    title: 'Automatic security updates',
    body: 'Apply security patches on their own as they are released, so the server stays current without a manual pass.',
  },
  {
    icon: KeyRound,
    title: 'Key-only SSH',
    body: 'Turn off password sign-in entirely and require a key, so only a held credential can ever connect.',
  },
  {
    icon: ListChecks,
    title: 'A server audit',
    body: 'Review the server against a hardening baseline and report what is set and what is worth tightening.',
  },
];

/** The platform promises that hold under every security change. */
const promises: SecurityItem[] = [
  {
    icon: CheckCircle2,
    title: 'Planned and approved by you',
    body: 'Every change is planned first and shown to you, and nothing runs on your server until you approve it.',
  },
  {
    icon: ShieldCheck,
    title: 'Verified, or rolled back',
    body: 'Verification always follows execution, and a change that would cut you off is caught and rolled back before it counts.',
  },
  {
    icon: KeyRound,
    title: 'Credentials sealed',
    body: 'Your credentials are sealed in your platform keystore and never shown, so a secret is never left on a screen.',
  },
];

/**
 * The shield-and-fox motif: the SlideOps fox held inside a warm shield, the
 * protective heart of the beat. The shield is drawn from palette tokens and the
 * fox mark sits at its centre with a slow, seamless breathe. A warm ember glow
 * sits behind it. It is decorative, hidden from assistive technology, and fully
 * still under reduced motion (the breathe is a CSS animation the global
 * reduce-motion query halts, and the glow drops its pulse).
 */
function ShieldFox() {
  return (
    <div aria-hidden className="relative mx-auto aspect-square w-full max-w-[22rem]">
      <Glow color="ember" size="24rem" x="50%" y="48%" pulse className="-z-10" />
      <svg
        viewBox="0 0 120 138"
        className="h-full w-full drop-shadow"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* The outer shield body, a warm cognac rim over the panel surface. */}
        <path
          d="M60 6 L110 27 V70 C110 103 87 124 60 133 C33 124 10 103 10 70 V27 Z"
          fill="var(--so-hero-panel)"
          stroke="var(--so-cognac)"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        {/* A fine peach inner rim, the warm highlight rolling along the crease. */}
        <path
          d="M60 15 L101 32 V69 C101 96 82 114 60 122 C38 114 19 96 19 69 V32 Z"
          fill="none"
          stroke="var(--so-peach)"
          strokeOpacity="0.5"
          strokeWidth="1"
          strokeLinejoin="round"
        />
      </svg>
      <span className="so-core-breathe absolute left-1/2 top-[46%] -translate-x-1/2 -translate-y-1/2">
        <Mark size={104} />
      </span>
    </div>
  );
}

/** One outcome row: a warm-bordered icon tile beside a title and a plain line. */
function ItemRow({ item, index }: { item: SecurityItem; index: number }) {
  const { icon: Icon, title, body } = item;
  return (
    <Reveal as="li" kind="slide" direction="up" delay={index * 0.06}>
      <div className="flex gap-4">
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-[color:var(--so-hero-hairline)] bg-[var(--so-hero-panel)] text-[color:var(--so-peach)]">
          <Icon width={18} height={18} aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="font-medium text-[color:var(--so-hero-ink)]">{title}</p>
          <p className="mt-1 text-sm leading-relaxed text-[color:var(--so-hero-ink-soft)]">{body}</p>
        </div>
      </div>
    </Reveal>
  );
}

/** One column of security outcomes under a small label. */
function ItemColumn({ label, items }: { label: string; items: SecurityItem[] }) {
  return (
    <div>
      <Reveal kind="fade">
        <p className="text-sm font-semibold text-[color:var(--so-peach)]">{label}</p>
      </Reveal>
      <ul className="mt-5 flex flex-col gap-5">
        {items.map((item, index) => (
          <ItemRow key={item.title} item={item} index={index} />
        ))}
      </ul>
    </div>
  );
}

/**
 * The security-first beat, on the warm-dark hero-world so it reads as protective.
 * It leads with the promise that SlideOps never operates as root once connected,
 * then tells the whole security story: the Core hardening applied the moment a
 * server is connected (secure SSH with root sign-in off, the host firewall, a
 * non-root administrator, and package and system updates), the security
 * marketplace add-ons a Project can install (fail2ban, automatic security
 * updates, key-only SSH, and a server audit), and the platform promises that hold
 * under all of it: every change is planned and approved, verification always
 * follows execution and a change that would cut you off is rolled back, and
 * credentials are sealed and never shown. A shield-and-fox motif carries the
 * feeling, with warm glow accents from the palette. Everything reveals on scroll
 * and is fully composed and still under reduced motion.
 */
export function SecuritySection() {
  return (
    <section id="security" className="so-hero-world relative isolate overflow-hidden">
      {/* Ambient warmth behind the whole beat, all decorative. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <Glow color="ember" size="44rem" x="82%" y="14%" pulse />
        <Glow color="warm" size="40rem" x="10%" y="84%" pulse />
        <Grain style={{ position: 'absolute' }} />
      </div>

      <div className="mx-auto max-w-6xl px-6 py-20 md:py-28">
        <div className="grid items-center gap-12 md:grid-cols-2 md:gap-16">
          <div className="max-w-xl">
            <Reveal kind="fade">
              <span className="inline-flex items-center gap-2 rounded-pill border border-[color:var(--so-hero-hairline)] bg-[var(--so-hero-panel)] px-3 py-1 text-xs font-medium uppercase tracking-wide text-[color:var(--so-hero-ink-faint)]">
                Security first
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
                The moment you connect a server, SlideOps secures it, and from then on it operates
                only as a non-root administrator. It never holds root, and it never asks you to keep
                it open.
              </p>
            </Reveal>

            <Reveal kind="slide" direction="up" delay={0.35}>
              <p className="mt-8 inline-flex items-start gap-3 rounded-xl border border-[color:var(--so-cognac)] bg-[var(--so-hero-panel)] p-4 text-base font-medium text-[color:var(--so-hero-ink)]">
                <ShieldCheck
                  width={20}
                  height={20}
                  className="mt-0.5 shrink-0 text-[color:var(--so-peach)]"
                  aria-hidden
                />
                SlideOps never operates as root once connected.
              </p>
            </Reveal>
          </div>

          {/* The shield-and-fox motif leads visually on desktop, sits above on mobile. */}
          <div className="order-first md:order-none">
            <ShieldFox />
          </div>
        </div>

        <div className="mt-16 grid gap-12 sm:grid-cols-2 lg:gap-16">
          <ItemColumn label="Core hardening, built in" items={coreHardening} />
          <ItemColumn label="Security add-ons, from the marketplace" items={securityAddOns} />
        </div>

        <div className="mt-16">
          <Reveal kind="fade">
            <p className="text-sm font-semibold text-[color:var(--so-peach)]">
              And the promises under all of it
            </p>
          </Reveal>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {promises.map((promise, index) => {
              const { icon: Icon, title, body } = promise;
              return (
                <Reveal key={title} delay={index * 0.08} className="h-full">
                  <article className="flex h-full flex-col rounded-xl border border-[color:var(--so-hero-hairline)] bg-[var(--so-hero-panel)] p-5">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-[color:var(--so-marketing-ink)] text-[color:var(--so-peach)]">
                      <Icon width={20} height={20} aria-hidden />
                    </span>
                    <p className="mt-4 font-medium text-[color:var(--so-hero-ink)]">{title}</p>
                    <p className="mt-2 text-sm leading-relaxed text-[color:var(--so-hero-ink-soft)]">
                      {body}
                    </p>
                  </article>
                </Reveal>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
