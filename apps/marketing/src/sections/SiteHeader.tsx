import { Button, Text } from '@slideops/design-system';
import { Logo } from '@slideops/icons';
import { ThemeToggle } from '../components/ThemeToggle';
import { signInUrl, signUpUrl } from '../content/site';

const navLinks = [
  { href: '#capabilities', label: 'Capabilities' },
  { href: '#who', label: 'Who it is for' },
  { href: '#docs', label: 'Docs' },
  { href: '#pricing', label: 'Pricing' },
];

/** The sticky site header: the lockup, section links, theme, and the sign in calls. */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-app/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
        <a href="#top" className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus" aria-label="SlideOps home">
          <Logo size={28} />
        </a>
        <nav aria-label="Sections" className="hidden items-center gap-1 lg:flex">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="rounded-md px-3 py-2 text-sm font-medium text-ink-muted transition-colors duration-fast ease-standard hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            >
              <Text as="span" variant="body-sm">
                {link.label}
              </Text>
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <a
            href={signInUrl}
            className="hidden rounded-md px-3 py-2 text-sm font-medium text-ink transition-colors duration-fast ease-standard hover:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus sm:inline-flex"
          >
            Sign in
          </a>
          <a href={signUpUrl}>
            <Button size="sm">Sign up</Button>
          </a>
        </div>
      </div>
    </header>
  );
}
