import { Button, Text } from '@slideops/design-system';
import { ArrowRight, Logo } from '@slideops/icons';
import { Link } from 'react-router-dom';
import { ThemeToggle } from '../ThemeToggle';
import { signInUrl, signUpUrl } from '../content/site';

const navLinks = [
  { to: '/capabilities', label: 'Capabilities' },
  { to: '/audience', label: 'Who it is for' },
  { to: '/docs', label: 'Docs' },
  { to: '/pricing', label: 'Pricing' },
];

/** The sticky site header: the lockup, section links, theme, and the sign in calls. */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-app/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3.5">
        <Link
          to="/"
          className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          aria-label="SlideOps home"
        >
          <Logo size={28} />
        </Link>
        <nav
          aria-label="Sections"
          className="hidden items-center gap-5 lg:flex"
        >
          {navLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className="rounded-md px-1 py-1.5 text-sm font-medium text-ink-muted transition-colors duration-fast ease-standard hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
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
          <Link to={signUpUrl}>
            <Button size="sm">
              Sign up
              <ArrowRight width={15} height={15} aria-hidden />
            </Button>
          </Link>
        </div>
      </div>
    </header>
  );
}
