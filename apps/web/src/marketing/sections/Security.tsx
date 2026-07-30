import { Text } from '@slideops/design-system';
import {
  KeyRound,
  Lock,
  RefreshCw,
  Server,
  Shield,
  ShieldCheck,
  Users,
  type LucideIcon,
} from '@slideops/icons';
import { useReveal } from '../useReveal';

interface Guarantee {
  icon: LucideIcon;
  title: string;
  body: string;
}

const guarantees: Guarantee[] = [
  {
    icon: Users,
    title: 'Never as root',
    body: 'SlideOps creates a dedicated non-root administrator with sudo and operates only as that account, so root is never the way in.',
  },
  {
    icon: ShieldCheck,
    title: 'Hardened SSH',
    body: 'Root sign-in is turned off and the host firewall denies incoming by default, always keeping your current SSH port open first.',
  },
  {
    icon: Lock,
    title: 'Sealed credentials',
    body: 'Connection secrets are encrypted at rest and decrypted only at connection time. They are never shown, logged, or returned.',
  },
  {
    icon: KeyRound,
    title: 'Trusted on first use',
    body: 'A host key is trusted the first time you connect and pinned after, so a changed key is noticed rather than silently accepted.',
  },
  {
    icon: RefreshCw,
    title: 'Rotate access safely',
    body: 'A server settings page rotates the connection credential and manages the accounts on the server, without ever locking you out.',
  },
  {
    icon: Shield,
    title: 'Verify, then rollback',
    body: 'Every execution is verified, and a change that would cut off your access is caught and rolled back before it can strand you.',
  },
];

/** Security first: no root, hardening, sealed credentials, and verified rollback. */
export function Security() {
  const { ref, shown } = useReveal<HTMLDivElement>();
  return (
    <section id="security" className="mx-auto max-w-6xl px-6 py-20 md:py-24">
      <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
        <div className="so-rise lg:sticky lg:top-24">
          <Text variant="caption" tone="accent">
            Security first
          </Text>
          <Text as="h2" variant="h1" className="mt-3">
            Locked down by default, and you keep the keys
          </Text>
          <Text variant="body" tone="secondary" className="mt-5">
            Security is the one thing that is Core on every server, and it is not a setting you have
            to remember. SlideOps drops root, hardens SSH, seals your credentials, and proves it is
            safe before it commits, so the secure path is also the easy one.
          </Text>
          <div className="mt-6 flex items-center gap-3 rounded-lg border border-border bg-subtle p-4">
            <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-app text-brand">
              <Server width={22} height={22} aria-hidden />
            </span>
            <Text variant="body-sm">
              You always own the infrastructure. SlideOps operates it with least privilege and
              leaves a full, readable record of every change.
            </Text>
          </div>
        </div>

        <div
          ref={ref}
          className={`grid gap-4 sm:grid-cols-2 so-reveal${shown ? ' so-reveal-in' : ''}`}
        >
          {guarantees.map(({ icon: Icon, title, body }) => (
            <article
              key={title}
              className="so-stagger rounded-lg border border-border bg-surface p-5 transition-shadow duration-base ease-standard hover:shadow-md"
            >
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-subtle text-brand">
                <Icon width={20} height={20} aria-hidden />
              </span>
              <Text variant="h4" className="mt-3 text-base">
                {title}
              </Text>
              <Text variant="body-sm" tone="secondary" className="mt-1.5">
                {body}
              </Text>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
