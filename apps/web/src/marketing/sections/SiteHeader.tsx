import { Button, cn, Text } from '@slideops/design-system';
import { Logo, Menu, X } from '@slideops/icons';
import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ThemeToggle } from '../ThemeToggle';
import { signInUrl, signUpUrl } from '../content/site';

/** The primary sections and pages the header reaches, in reading order. */
const navLinks = [
  { to: '/capabilities', label: 'Capabilities' },
  { to: '/security', label: 'Security' },
  { to: '/pricing', label: 'Pricing' },
  { to: '/audience', label: 'Who it is for' },
  { to: '/docs', label: 'Docs' },
];

/** How far the page must scroll before the header settles into its lifted state. */
const SCROLL_ELEVATE = 8;

/**
 * The sticky site header, brought into the living aesthetic.
 *
 * It rides above the alternating dark and light worlds on a translucent, blurred
 * app-token surface, so it always carries its own legible background whichever
 * world sits behind it. It is scroll-aware: at the very top, over the warm-dark
 * hero, it floats almost seamless; the moment the page moves it settles into a
 * lifted bar with a hairline and a soft shadow, the wordmark reading as part of
 * the header rather than the hero. Every colour is an app design token, so the
 * bar and its text stay legible in both app themes.
 *
 * The full lockup, the primary navigation, the theme toggle, and the sign in and
 * sign up calls are all here. Navigation is a landmark, every control carries a
 * token focus-visible ring, and below the large breakpoint the links collapse
 * into an accessible disclosure menu. The MarketingLayout skip link still lands
 * on the content ahead of all of it.
 */
export function SiteHeader() {
  const [elevated, setElevated] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  // Settle the header the moment the page leaves the top. Passive and cheap: it
  // only flips a boolean, and the visual change is a short token transition the
  // global reduce-motion query shortens along with everything else.
  useEffect(() => {
    const onScroll = () => setElevated(window.scrollY > SCROLL_ELEVATE);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // A route change closes the mobile menu, so it never lingers across pages.
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  return (
    <header
      className={cn(
        'sticky top-0 z-40 border-b backdrop-blur transition-colors duration-base ease-standard',
        elevated || menuOpen
          ? 'border-border bg-app/85 shadow-sm'
          : 'border-transparent bg-app/60',
      )}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
        <Link
          to="/"
          className="rounded-md text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          aria-label="SlideOps home"
        >
          <Logo size={28} />
        </Link>

        <nav aria-label="Sections" className="hidden items-center gap-1 lg:flex">
          {navLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className="rounded-md px-3 py-2 text-sm font-medium text-ink-muted transition-colors duration-fast ease-standard hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            >
              <Text as="span" variant="body-sm">
                {link.label}
              </Text>
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link
            to={signInUrl}
            className="hidden rounded-md px-3 py-2 text-sm font-medium text-ink transition-colors duration-fast ease-standard hover:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus sm:inline-flex"
          >
            Sign in
          </Link>
          <Link to={signUpUrl} className="hidden sm:inline-flex">
            <Button size="sm">Sign up</Button>
          </Link>

          {/* The menu control appears only below the large breakpoint, where the
              inline navigation is hidden. */}
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-expanded={menuOpen}
            aria-controls="site-menu"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            className="inline-flex h-10 w-10 items-center justify-center rounded-md text-ink-muted transition-colors duration-fast ease-standard hover:bg-subtle hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus lg:hidden"
          >
            {menuOpen ? (
              <X width={18} height={18} aria-hidden />
            ) : (
              <Menu width={18} height={18} aria-hidden />
            )}
          </button>
        </div>
      </div>

      {/* The mobile disclosure: the full navigation plus the sign in calls, on the
          same adaptive surface, revealed only when open. */}
      {menuOpen ? (
        <div id="site-menu" className="border-t border-border lg:hidden">
          <nav
            aria-label="Sections"
            className="mx-auto flex max-w-6xl flex-col gap-1 px-6 py-4"
          >
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className="rounded-md px-3 py-2 text-sm font-medium text-ink-muted transition-colors duration-fast ease-standard hover:bg-subtle hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
              >
                {link.label}
              </Link>
            ))}
            <div className="mt-2 flex items-center gap-3 border-t border-border pt-4">
              <Link
                to={signInUrl}
                className="rounded-md px-3 py-2 text-sm font-medium text-ink transition-colors duration-fast ease-standard hover:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
              >
                Sign in
              </Link>
              <Link to={signUpUrl} className="flex-1">
                <Button size="sm" className="w-full">
                  Sign up
                </Button>
              </Link>
            </div>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
