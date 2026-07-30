import {
  Boxes,
  Container,
  Database,
  GitBranch,
  Gauge,
  KeyRound,
  Lock,
  MessageSquare,
  Network,
  Package,
  Search,
  Server,
  Shield,
  Terminal,
  Users,
  Waypoints,
  type LucideIcon,
} from '@slideops/icons';

/*
 * The Capability set, presented as outcomes.
 *
 * This list had drifted badly from the product. It advertised twelve
 * Capabilities when ninety six ship, put Enable Monitoring in the marketplace
 * when it is Core on every server, and offered a "Server Audit" that does not
 * exist and never did. Undersell is the smaller of those problems: naming a
 * Capability nobody can run is a promise the product cannot keep.
 *
 * The counts below are the real ones, and the split between Core and marketplace
 * is the split the API actually enforces. Core is what `GET /capabilities` with
 * no Project returns: seven outcomes available on every server with nothing to
 * install. Everything else comes from a Plugin installed per Project.
 */

export type CapabilityOrigin = 'Core' | 'Marketplace';

export interface ShowcaseCapability {
  icon: LucideIcon;
  name: string;
  category: string;
  origin: CapabilityOrigin;
  description: string;
}

/** How many Capabilities ship, so no page has to guess or go stale quietly. */
export const capabilityCount = 96;
/** Core Capabilities, available on every server with nothing installed. */
export const coreCapabilityCount = 7;
/** Capabilities that arrive with a marketplace Plugin, installed per Project. */
export const marketplaceCapabilityCount = capabilityCount - coreCapabilityCount;
/** Categories the catalogue is organised into. */
export const capabilityCategoryCount = 13;

/**
 * The Core Capabilities: every one of them, since there are only seven and a
 * partial list of what is included by default invites the wrong conclusion about
 * the rest.
 */
export const coreCapabilities: ShowcaseCapability[] = [
  {
    icon: KeyRound,
    name: 'Secure SSH',
    category: 'Security',
    origin: 'Core',
    description:
      'Harden SSH and stop root signing in directly, verified with a fresh connection so you are never locked out of your own server.',
  },
  {
    icon: Shield,
    name: 'Configure firewall',
    category: 'Security',
    origin: 'Core',
    description:
      'Close everything that does not need to be open, and keep the ports your own applications answer on.',
  },
  {
    icon: Users,
    name: 'Create application user',
    category: 'System',
    origin: 'Core',
    description:
      'Give applications an account of their own with only the access they need, so nothing runs as root because it was easier.',
  },
  {
    icon: Users,
    name: 'Manage server user',
    category: 'System',
    origin: 'Core',
    description:
      'Add a person to a server, with or without sudo, without hand editing anything or sharing one login between people.',
  },
  {
    icon: Users,
    name: 'Remove server user',
    category: 'System',
    origin: 'Core',
    description:
      'Take an account off a server when someone leaves, and see it confirmed rather than assumed.',
  },
  {
    icon: Package,
    name: 'Manage packages',
    category: 'System',
    origin: 'Core',
    description:
      'Install and update packages through whichever package manager the server actually uses, with the plan shown before anything runs.',
  },
  {
    icon: Gauge,
    name: 'Enable monitoring',
    category: 'Monitoring',
    origin: 'Core',
    description:
      'Start collecting load, memory, disk and service counts on a schedule, so a server can tell you how it is doing.',
  },
];

/**
 * A representative slice of the marketplace, one per area rather than all
 * eighty nine. The page says how many there are; listing every PostgreSQL and
 * Ruby entry would bury the point rather than make it.
 */
export const marketplaceCapabilities: ShowcaseCapability[] = [
  {
    icon: Database,
    name: 'Databases',
    category: '28 Capabilities',
    origin: 'Marketplace',
    description:
      'PostgreSQL, MySQL, MariaDB, MongoDB, Redis and Memcached: install one, create a database and a user for an application, or inspect what is already running.',
  },
  {
    icon: Container,
    name: 'Containers and orchestration',
    category: '9 Capabilities',
    origin: 'Marketplace',
    description:
      'Docker, Docker Compose, Podman and k3s, including reading a Compose file that was on the server before SlideOps ever saw it.',
  },
  {
    icon: Waypoints,
    name: 'Web servers and proxies',
    category: '10 Capabilities',
    origin: 'Marketplace',
    description:
      'NGINX, Apache, Caddy and HAProxy, put in front of your applications and pointed at the right one.',
  },
  {
    icon: Lock,
    name: 'HTTPS and certificates',
    category: 'Security',
    origin: 'Marketplace',
    description:
      'A certificate issued and renewed for a real hostname, verified by asking for the page rather than by trusting that it worked.',
  },
  {
    icon: GitBranch,
    name: 'Deploy from a repository',
    category: 'Deployment',
    origin: 'Marketplace',
    description:
      'Pull a branch, build it, and run it, with the next deploy noticing there are new commits waiting for it.',
  },
  {
    icon: Server,
    name: 'Language runtimes',
    category: '12 Capabilities',
    origin: 'Marketplace',
    description:
      'Node.js, Python, Go, PHP, Ruby, Rust and Java, installed at a version you choose and removable when you are done with them.',
  },
  {
    icon: MessageSquare,
    name: 'Messaging and queues',
    category: '9 Capabilities',
    origin: 'Marketplace',
    description:
      'RabbitMQ and NATS, with vhosts and users created for the applications that need them.',
  },
  {
    icon: Search,
    name: 'Search and object storage',
    category: '8 Capabilities',
    origin: 'Marketplace',
    description:
      'Meilisearch and MinIO, for the two things an application usually needs a second server for.',
  },
  {
    icon: Network,
    name: 'Private networking',
    category: '5 Capabilities',
    origin: 'Marketplace',
    description:
      'WireGuard interfaces and peers, so servers can talk to each other without going out over the public internet.',
  },
  {
    icon: Shield,
    name: 'Hardening add-ons',
    category: 'Security',
    origin: 'Marketplace',
    description:
      'Fail2ban, unattended security updates, and key-only SSH enforcement, each verified after it is applied.',
  },
  {
    icon: Boxes,
    name: 'Backups',
    category: 'Backup',
    origin: 'Marketplace',
    description:
      'Scheduled backups configured on the server itself, so the data outlives the machine holding it.',
  },
  {
    icon: Terminal,
    name: 'Inspect what is already there',
    category: 'Adoption',
    origin: 'Marketplace',
    description:
      'Read an existing NGINX, PostgreSQL, Docker Compose or k3s install without changing a thing, and bring it under management as it stands.',
  },
];

/** The full showcase list, Core first, then the marketplace. */
export const dayOneCapabilities: ShowcaseCapability[] = [
  ...coreCapabilities,
  ...marketplaceCapabilities,
];
