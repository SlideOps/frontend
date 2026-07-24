import { Button } from '@slideops/design-system';
import { ArrowRight, ShieldCheck } from '@slideops/icons';
import { Link } from 'react-router-dom';
import { signUpUrl } from '../content/site';
import { Glow, Grain, Reveal, WordReveal } from '../motion';
import { NodeNetwork } from './NodeNetwork';

const headline = 'Knowledge becomes Capabilities. Capabilities create Confidence.';

const assurances = [
  'Your servers stay yours',
  'Approval before any change',
  'Verification after every execution',
];

/**
 * Warm a key headline word into an ember as it arrives: every Capabilities into
 * cognac, every Confidence into peach. The primitive stays copy-agnostic; this
 * hook holds the hero's own emphasis, matched on the leading word so trailing
 * punctuation still lands.
 */
function warmWord(word: string): string | undefined {
  if (word.startsWith('Capabilities')) return 'so-hero-word-cognac';
  if (word.startsWith('Confidence')) return 'so-hero-word-peach';
  return undefined;
}

/**
 * The living hero: the video's opening beat in our palette. The headline
 * assembles word by word over a breathing node network, the Capability engine
 * core radiating to its servers and Capabilities. Warm embers glow on warm
 * dark; the whole surface is a deliberate dark hero-world in both app themes.
 */
export function Hero() {
  return (
    <section id="top" className="so-hero-world relative isolate overflow-hidden">
      {/* Ambient warmth and the living network, all decorative and behind copy. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <Glow color="ember" size="46rem" x="78%" y="4%" pulse />
        <Glow color="warm" size="42rem" x="14%" y="72%" pulse />
        <Glow color="rose" size="30rem" x="52%" y="60%" pulse />
        <NodeNetwork className="absolute inset-0" coreY={0.64} />
        <Grain style={{ position: 'absolute' }} />
      </div>

      <div className="mx-auto flex min-h-[88vh] max-w-4xl flex-col items-center justify-center px-6 py-28 text-center md:py-36">
        <Reveal kind="fade">
          <span className="inline-flex items-center gap-2 rounded-pill border border-[color:var(--so-hero-hairline)] bg-[var(--so-hero-panel)] px-3 py-1 text-xs font-medium uppercase tracking-wide text-[color:var(--so-hero-ink-faint)]">
            Infrastructure Operations, in plain language
          </span>
        </Reveal>

        <WordReveal
          as="h1"
          text={headline}
          delay={0.15}
          stagger={0.09}
          wordClassName={warmWord}
          className="mt-7 max-w-3xl font-display text-5xl font-semibold tracking-tight text-[color:var(--so-hero-ink)] md:text-6xl"
        />

        <Reveal kind="fade" delay={0.5} className="max-w-2xl">
          <p className="mt-7 text-lg leading-relaxed text-[color:var(--so-hero-ink-soft)]">
            Connect and secure your servers over SSH, then run Projects on them: install only the
            stack each Project needs, deploy resource-limited Services from GitHub, and monitor
            everything. SlideOps orchestrates and explains the tools you already run, and it never
            owns your infrastructure. You do.
          </p>
        </Reveal>

        <Reveal kind="fade" delay={0.65}>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Link to={signUpUrl}>
              <Button size="lg">
                Get started
                <ArrowRight width={18} height={18} aria-hidden />
              </Button>
            </Link>
            <a
              href="#how"
              className="inline-flex h-12 items-center justify-center rounded-md border border-[color:var(--so-hero-hairline)] bg-[var(--so-hero-panel)] px-6 text-base font-medium text-[color:var(--so-hero-ink)] transition-colors duration-fast ease-standard hover:border-[color:var(--so-hero-ink-faint)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--so-marketing-ink)]"
            >
              See how it works
            </a>
          </div>
        </Reveal>

        <Reveal kind="fade" delay={0.8}>
          <ul className="mt-11 flex flex-wrap justify-center gap-x-6 gap-y-3">
            {assurances.map((line) => (
              <li key={line} className="flex items-center gap-2">
                <ShieldCheck
                  width={18}
                  height={18}
                  className="text-[color:var(--so-peach)]"
                  aria-hidden
                />
                <span className="text-sm leading-relaxed text-[color:var(--so-hero-ink-soft)]">
                  {line}
                </span>
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </section>
  );
}
