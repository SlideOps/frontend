import { Card, Text } from '@slideops/design-system';
import {
  ArrowUpRight,
  BookOpen,
  Boxes,
  Container,
  KeyRound,
  Network,
  Package,
  Server,
  ShieldCheck,
  type LucideIcon,
} from '@slideops/icons';
import { PageHeader } from '@slideops/ui';
import { OperatorShell } from '../components/OperatorShell';

/*
 * The Extensions foundation. It explains plugins in plain language and lists the
 * Providers that ship built in as the first extensions. There is no marketplace
 * and no install flow yet: this page is informational, and it points to the SDK
 * documentation for how an extension is built and registered.
 */

interface BuiltIn {
  name: string;
  icon: LucideIcon;
  summary: string;
  platforms: string;
}

/** The Providers that ship with SlideOps, presented as its first extensions. */
const BUILT_INS: BuiltIn[] = [
  {
    name: 'Package management',
    icon: Package,
    summary:
      'Installs and updates software through each platform native manager, so a Capability reads the same whatever the distribution runs.',
    platforms: 'apt, dnf, zypper, pacman, apk',
  },
  {
    name: 'Service management',
    icon: Server,
    summary: 'Enables, starts, and checks services so an outcome holds after the machine restarts.',
    platforms: 'systemd',
  },
  {
    name: 'SSH hardening',
    icon: KeyRound,
    summary:
      'Reads the SSH posture during Discovery and, with an approved plan, tightens it without locking anyone out.',
    platforms: 'All supported platforms',
  },
  {
    name: 'Web and TLS',
    icon: Network,
    summary: 'Serves sites and provisions certificates so a domain is reachable over HTTPS.',
    platforms: 'All supported platforms',
  },
  {
    name: 'Firewall',
    icon: ShieldCheck,
    summary:
      'Sets network rules to the intent an Operator approves, with verification that they hold.',
    platforms: 'All supported platforms',
  },
  {
    name: 'Containers',
    icon: Container,
    summary: 'Runs and inspects container workloads through the platform container runtime.',
    platforms: 'All supported platforms',
  },
];

export function Extensions() {
  return (
    <OperatorShell active="extensions">
      <PageHeader
        title="Extensions"
        description="SlideOps is built from Providers: small units that teach it how to reach an outcome on a platform. A plugin bundles Providers and Capabilities behind one manifest, so the same discover, plan, approve, execute, and verify loop can grow without changing its shape."
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="flex flex-col gap-6">
          <Card className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <Boxes width={20} height={20} className="text-brand" aria-hidden />
              <Text variant="h4">How a plugin works</Text>
            </div>
            <Text variant="body-sm" tone="secondary">
              A plugin declares a manifest and provides one or more Providers and the Capabilities
              they deliver. A Provider says which platforms it supports and how to reach an outcome
              there; a Capability describes that outcome in plain language, independent of the
              technology behind it. When a plugin is compiled in, its Providers and Capabilities
              register into the platform and appear in the catalog and the capability matrix
              alongside the built-in ones.
            </Text>
            <Text variant="body-sm" tone="secondary">
              Every plugin runs inside the same guarantees as the rest of SlideOps. Discovery never
              changes a Node, nothing runs before an Operator approves a plan, verification always
              follows execution, and emergency pause and Operator suspend are always respected.
            </Text>
            <Text variant="body-sm" tone="secondary">
              A marketplace and dynamic loading are later phases. Today the surface is stable and
              documented so a plugin can be built and compiled in against it.
            </Text>
          </Card>

          <div>
            <Text variant="h4" className="mb-3">
              Built in Providers
            </Text>
            <div className="grid gap-4 sm:grid-cols-2">
              {BUILT_INS.map((item) => {
                const Icon = item.icon;
                return (
                  <Card key={item.name} className="flex flex-col gap-3">
                    <div className="flex items-center gap-3">
                      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-subtle text-brand">
                        <Icon width={18} height={18} aria-hidden />
                      </span>
                      <Text variant="h4" className="text-base">
                        {item.name}
                      </Text>
                    </div>
                    <Text variant="body-sm" tone="secondary">
                      {item.summary}
                    </Text>
                    <span className="rounded-pill bg-subtle px-2.5 py-0.5 text-xs font-medium text-ink-muted">
                      {item.platforms}
                    </span>
                  </Card>
                );
              })}
            </div>
          </div>
        </div>

        <Card className="h-fit flex-col gap-4">
          <div className="flex items-center gap-2">
            <BookOpen width={20} height={20} className="text-brand" aria-hidden />
            <Text variant="h4">Build a plugin</Text>
          </div>
          <Text variant="body-sm" tone="secondary" className="mt-3">
            The SDK defines the Provider interface, the Capability metadata type, the Plugin
            interface, and the manifest fields: id, name, version, author, description, minimum
            SlideOps version, permissions, and what it provides.
          </Text>
          <a
            href="https://useslideops.com/docs/sdk"
            className="mt-4 inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-2 text-sm font-medium text-ink transition-colors duration-fast ease-standard hover:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          >
            Read the SDK documentation
            <ArrowUpRight width={15} height={15} aria-hidden />
          </a>
        </Card>
      </div>
    </OperatorShell>
  );
}
