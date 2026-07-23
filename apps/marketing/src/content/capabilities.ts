import {
  Container,
  Database,
  GitBranch,
  Gauge,
  KeyRound,
  Lock,
  Package,
  Shield,
  Users,
  Waypoints,
  type LucideIcon,
} from '@slideops/icons';

/*
 * The day-one Capability set, presented as outcomes. Each entry names what the
 * Operator achieves in plain language, the category it belongs to, and an icon.
 * These mirror the Capabilities the Operator app runs, so the marketing site and
 * the product describe the same work.
 */

export interface ShowcaseCapability {
  icon: LucideIcon;
  name: string;
  category: string;
  description: string;
}

export const dayOneCapabilities: ShowcaseCapability[] = [
  {
    icon: KeyRound,
    name: 'Secure SSH',
    category: 'Security',
    description:
      'Harden SSH access with key-based sign in and safe defaults, verified with a fresh connection so you are never locked out.',
  },
  {
    icon: Shield,
    name: 'Configure Firewall',
    category: 'Security',
    description:
      'Turn on a host firewall that denies incoming by default and always keeps your current SSH port open first.',
  },
  {
    icon: Package,
    name: 'Manage Packages and Updates',
    category: 'System',
    description:
      'Refresh the package index and apply available updates, or install exactly the set of packages you name.',
  },
  {
    icon: Users,
    name: 'Create Application User',
    category: 'System',
    description:
      'Add a dedicated non-root user for running applications, with an optional public key and optional sudo.',
  },
  {
    icon: Container,
    name: 'Enable Containers',
    category: 'Runtime',
    description:
      'Install and start a container runtime so your Node is ready to run containerized workloads.',
  },
  {
    icon: GitBranch,
    name: 'Deploy Repository',
    category: 'Delivery',
    description:
      'Clone or update a Git repository at a path you choose, with an optional build or start command.',
  },
  {
    icon: Waypoints,
    name: 'Configure Reverse Proxy',
    category: 'Networking',
    description:
      'Put a reverse proxy in front of your app so requests reach the right upstream, ready for HTTPS.',
  },
  {
    icon: Lock,
    name: 'Configure HTTPS',
    category: 'Networking',
    description:
      'Obtain and install a certificate for your domain so it answers securely over HTTPS, renewed automatically.',
  },
  {
    icon: Gauge,
    name: 'Enable Monitoring',
    category: 'Observability',
    description:
      'Record CPU, memory, disk, and service health on a schedule, ready to read from your Workspace.',
  },
  {
    icon: Database,
    name: 'Configure Backups',
    category: 'Data',
    description:
      'Schedule backups of the paths you name, with a documented path back to a restore when you need it.',
  },
];
