import { Button } from '@slideops/design-system';
import { ArrowRight, Mark } from '@slideops/icons';
import { Link } from 'react-router-dom';
import { signInUrl, signUpUrl } from '../content/site';
import { Glow, Grain, Reveal, WordReveal } from '../motion';

const headline = 'Bring your servers. Keep control.';

/**
 * Warm the closing word into a peach ember and the object into cognac as the line
 * lands, matching the hero and closing beats. The primitive stays copy-agnostic;
 * this holds the section's own emphasis, matched on the leading word so the
 * trailing period still resolves.
 */
function warmWord(word: string): string | undefined {
  if (word.startsWith('control')) return 'so-hero-word-peach';
  if (word.startsWith('servers')) return 'so-hero-word-cognac';
  return undefined;
}

/**
 * The contact-and-start beat, the warm horizon that closes the page. On the
 * warm-dark hero-world, a soft warm glow rises from the base like the underside
 * of the inspiration still, and the fox mark glows above a clear invitation with
 * the sign up and sign in calls, wired to the same shared routes the header uses.
 * It warms into the footer, so the page settles rather than stops. The headline
 * reveals word by word, the glow breathes, and the whole beat is composed and
 * still under reduced motion.
 */
export function Contact() {
  return (
    <section id="start" className="so-hero-world relative isolate overflow-hidden">
      {/* The warm horizon rising from the base, plus ambient glow and grain. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div
          className="absolute inset-x-0 bottom-0 h-4/5"
          style={{
            background:
              'radial-gradient(120% 100% at 50% 118%, var(--so-glow-ember) 0%, var(--so-glow-warm) 34%, transparent 70%)',
          }}
        />
        <Glow color="ember" size="46rem" x="50%" y="104%" pulse />
        <Glow color="warm" size="34rem" x="16%" y="20%" pulse />
        <Grain style={{ position: 'absolute' }} />
      </div>

      <div className="mx-auto max-w-3xl px-6 py-24 text-center md:py-32">
        <Reveal kind="scale">
          <span aria-hidden className="so-core-breathe inline-flex">
            <Mark size={64} />
          </span>
        </Reveal>

        <Reveal kind="fade" delay={0.1}>
          <span className="mt-8 inline-flex items-center gap-2 rounded-pill border border-[color:var(--so-hero-hairline)] bg-[var(--so-hero-panel)] px-3 py-1 text-xs font-medium uppercase tracking-wide text-[color:var(--so-hero-ink-faint)]">
            Start now
          </span>
        </Reveal>

        <WordReveal
          as="h2"
          text={headline}
          delay={0.15}
          stagger={0.08}
          wordClassName={warmWord}
          className="mx-auto mt-6 max-w-2xl font-display text-4xl font-semibold tracking-tight text-[color:var(--so-hero-ink)] md:text-6xl"
        />

        <Reveal kind="fade" delay={0.3}>
          <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-[color:var(--so-hero-ink-soft)]">
            Connect a Linux server you already own, secure it in a few approved steps, and run your
            Projects on it with a clear record of every change. You stay in control the whole way.
          </p>
        </Reveal>

        <Reveal kind="slide" direction="up" delay={0.4}>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link to={signUpUrl} className="w-full sm:w-auto">
              <Button size="lg" className="w-full sm:w-auto">
                Sign up
                <ArrowRight width={18} height={18} aria-hidden />
              </Button>
            </Link>
            <Link
              to={signInUrl}
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-md border border-[color:var(--so-hero-hairline)] bg-[color:var(--so-marketing-ink)] px-6 text-base font-medium text-[color:var(--so-hero-ink)] transition-colors duration-fast ease-standard hover:border-[color:var(--so-hero-ink-faint)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--so-marketing-ink)] sm:w-auto"
            >
              Sign in
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
