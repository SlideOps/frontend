import {
  Container,
  Database,
  GitBranch,
  Gauge,
  KeyRound,
  ListChecks,
  Lock,
  Package,
  RefreshCw,
  Shield,
  Users,
  Waypoints,
  type LucideIcon,
} from '@slideops/icons';

/*
 * The Capability set, presented as outcomes. Each entry names what the Operator
 * achieves in plain language, the category it belongs to, whether it is Core (on
 * every server) or a marketplace Plugin (installed per Project), and an icon.
 * These mirror the Capabilities the Operator app runs, so the marketing site and
 * the product describe the same work.
 */

export type CapabilityOrigin = 'Core' | 'Marketplace';

export interface ShowcaseCapability {
  icon: LucideIcon;
  name: string;
  category: string;
  origin: CapabilityOrigin;
  description: string;
}

/** The four security outcomes on every server, pre-installed with nothing to add. */
export const coreCapabilities: ShowcaseCapability[] = [
  {
    icon: KeyRound,
    name: 'Secure SSH',
    category: 'Security',
    origin: 'Core',
    description:
      'Harden SSH and stop root signing in directly, verified with a fresh connection so you are never locked out.',
  },
  {
    icon: Shield,
    name: 'Configure Firewall',
    category: 'Security',
    origin: 'Core',
    description:
      'Turn on a host firewall that denies incoming by default and always keeps your current SSH port open first.',
  },
  {
    icon: Users,
    name: 'Create Application User',
    category: 'Security',
    origin: 'Core',
    description:
      'Add a dedicated non-root administrator with sudo, so SlideOps operates the server without ever being root.',
  },
  {
    icon: Package,
    name: 'Manage Packages and Updates',
    category: 'System',
    origin: 'Core',
    description:
      'Refresh the package index and apply available updates, or install exactly the set of packages you name.',
  },
];

/** Everything else: marketplace Plugins installed per Project, so a Project carries only its stack. */
export const marketplaceCapabilities: ShowcaseCapability[] = [
  {
    icon: Container,
    name: 'Enable Containers',
    category: 'Runtime',
    origin: 'Marketplace',
    description:
      'Install and start a container runtime so a Project is ready to run containerized Services.',
  },
  {
    icon: GitBranch,
    name: 'Deploy Repository',
    category: 'Delivery',
    origin: 'Marketplace',
    description:
      'Clone a Git repository on first deploy and pull the branch you name on every redeploy, with an optional build or start command.',
  },
  {
    icon: Waypoints,
    name: 'Configure Reverse Proxy',
    category: 'Networking',
    origin: 'Marketplace',
    description:
      'Put a reverse proxy in front of your Services so requests reach the right upstream, ready for HTTPS.',
  },
  {
    icon: Lock,
    name: 'Configure HTTPS',
    category: 'Networking',
    origin: 'Marketplace',
    description:
      'Obtain and install a certificate for your domain so it answers securely over HTTPS, renewed automatically.',
  },
  {
    icon: Gauge,
    name: 'Enable Monitoring',
    category: 'Observability',
    origin: 'Marketplace',
    description:
      'Record CPU, memory, disk, and Service health on a schedule, ready to read from your Workspace.',
  },
  {
    icon: Database,
    name: 'Configure Backups',
    category: 'Data',
    origin: 'Marketplace',
    description:
      'Schedule backups of the paths you name, with a documented path back to a restore when you need it.',
  },
  {
    icon: RefreshCw,
    name: 'Automatic Security Updates',
    category: 'Security add-on',
    origin: 'Marketplace',
    description:
      'Keep security patches flowing on their own, using the unattended update mechanism your distribution provides.',
  },
  {
    icon: ListChecks,
    name: 'Server Audit',
    category: 'Security add-on',
    origin: 'Marketplace',
    description:
      'Run a read-only hardening audit that reports where a server can be tightened, changing nothing on its own.',
  },
];

/** The full showcase list, Core security first, then the marketplace. */
export const dayOneCapabilities: ShowcaseCapability[] = [
  ...coreCapabilities,
  ...marketplaceCapabilities,
];
