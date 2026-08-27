import { Button, Text } from '@slideops/design-system';
import { ArrowRight, Logo } from '@slideops/icons';
import { Link } from 'react-router-dom';
import { signInUrl, signUpUrl, tagline } from '../content/site';

interface FooterLink {
  to: string;
  label: string;
  external?: boolean;
}

const columns: { heading: string; links: FooterLink[] }[] = [
  {
    heading: 'Platform',
    links: [
      { to: '/#model', label: 'Servers and Projects' },
      { to: '/#lifecycle', label: 'The lifecycle' },
      { to: '/#security', label: 'Security' },
      { to: '/#deploy', label: 'Deploy and monitor' },
    ],
  },
  {
    heading: 'Product',
    links: [
      { to: '/capabilities', label: 'Capabilities' },
      { to: '/audience', label: 'Who it is for' },
      { to: '/pricing', label: 'Pricing' },
      { to: '/#faq', label: 'FAQ' },
    ],
  },
  {
    heading: 'Learn',
    links: [
      { to: '/docs', label: 'Getting started' },
      { to: '/docs', label: 'Servers and Projects' },
      { to: '/docs', label: 'How an Operation works' },
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

/** The footer: the wordmark, a closing line, a final call, and grouped links. */
export function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-border bg-app">
      <div className="mx-auto max-w-6xl px-6 py-14">
        <div className="grid gap-10 md:grid-cols-[1.6fr_1fr_1fr_1fr_1fr]">
          <div>
            <Logo size={28} />
            <Text variant="body-sm" tone="secondary" className="mt-4 max-w-xs">
              {tagline}
            </Text>
            <Link to={signUpUrl} className="mt-5 inline-flex">
              <Button size="sm">
                Get started
                <ArrowRight width={15} height={15} aria-hidden />
              </Button>
            </Link>
          </div>
          {columns.map((column) => (
            <nav key={column.heading} aria-label={column.heading}>
              <Text variant="caption" tone="secondary">
                {column.heading}
              </Text>
              <ul className="mt-4 flex flex-col gap-2">
                {column.links.map((link) => (
                  <li key={`${column.heading}-${link.label}`}>
                    <Link
                      to={link.to}
                      className="rounded-md text-sm text-ink-muted transition-colors duration-fast ease-standard hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-12 flex flex-col items-start justify-between gap-3 border-t border-border pt-6 md:flex-row md:items-center">
          <Text variant="body-sm" tone="secondary">
            Built for Operators who stay in control. useslideops.com
          </Text>
          <Text variant="body-sm" tone="secondary">
            &copy; {year} SlideOps
          </Text>
        </div>
      </div>
    </footer>
  );
}
