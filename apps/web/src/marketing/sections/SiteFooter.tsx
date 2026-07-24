import { Logo } from '@slideops/icons';
import { Link } from 'react-router-dom';
import { Glow, Grain } from '../motion';
import { signInUrl, signUpUrl, tagline } from '../content/site';

const columns = [
  {
    heading: 'Product',
    links: [
      { to: '/capabilities', label: 'Capabilities' },
      { to: '/security', label: 'Security' },
      { to: '/audience', label: 'Who it is for' },
      { to: '/pricing', label: 'Pricing' },
    ],
  },
  {
    heading: 'Learn',
    links: [
      { to: '/docs', label: 'Docs' },
      { to: '/docs', label: 'Getting started' },
      { to: '/docs', label: 'Servers and Projects' },
      { to: '/docs', label: 'How an Operation works' },
      { to: '/faq', label: 'FAQ' },
    ],
  },
  {
    heading: 'Get started',
    links: [
      { to: signUpUrl, label: 'Sign up' },
      { to: signInUrl, label: 'Sign in' },
    ],
  },
];

/**
 * The footer: the rich, warm-dark close to the page. On the hero-world so it
 * settles out of the contact horizon rather than switching worlds, it carries the
 * wordmark and tagline, the grouped navigation and doc links (including the
 * Servers and Projects guide), and the sign in calls. A soft token glow breathes
 * behind the wordmark as the one micro-motion, on a compositor-friendly loop the
 * global reduce-motion query halts to a still glow. Every link and route is kept.
 */
export function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="so-hero-world relative isolate overflow-hidden border-t border-[color:var(--so-hero-hairline)]">
      {/* A quiet warm wash and the tactile grain behind the close, decorative. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <Glow color="warm" size="30rem" x="6%" y="0%" />
        <Grain style={{ position: 'absolute' }} />
      </div>

      <div className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            {/* The wordmark with a soft, breathing token glow, the one micro-motion. */}
            <div className="relative inline-flex">
              <Glow color="ember" size="12rem" x="40%" y="50%" pulse className="-z-10" />
              <Logo size={30} />
            </div>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-[color:var(--so-hero-ink-soft)]">
              {tagline}
            </p>
          </div>
          {columns.map((column) => (
            <nav key={column.heading} aria-label={column.heading}>
              <p className="text-xs font-medium uppercase tracking-wide text-[color:var(--so-hero-ink-faint)]">
                {column.heading}
              </p>
              <ul className="mt-4 flex flex-col gap-2">
                {column.links.map((link) => (
                  <li key={`${column.heading}-${link.label}`}>
                    <Link
                      to={link.to}
                      className="rounded-md text-sm text-[color:var(--so-hero-ink-soft)] transition-colors duration-fast ease-standard hover:text-[color:var(--so-hero-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-12 flex flex-col items-start justify-between gap-3 border-t border-[color:var(--so-hero-hairline)] pt-6 md:flex-row md:items-center">
          <p className="text-sm text-[color:var(--so-hero-ink-soft)]">
            Built for Operators who stay in control.
          </p>
          <p className="text-sm text-[color:var(--so-hero-ink-faint)]">&copy; {year} SlideOps</p>
        </div>
      </div>
    </footer>
  );
}
