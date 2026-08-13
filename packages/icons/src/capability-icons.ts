import type { ComponentType, SVGProps } from 'react';
import {
  Activity,
  Boxes,
  Container,
  Cpu,
  Database,
  Download,
  Globe,
  HardDrive,
  Layers,
  MessageSquare,
  Network,
  Rocket,
  Search,
  Settings,
  Shield,
} from './index';
import {
  ApacheIcon,
  DockerIcon,
  GoIcon,
  JavaIcon,
  K3sIcon,
  MariaDBIcon,
  MeilisearchIcon,
  MinIOIcon,
  MongoDBIcon,
  MySQLIcon,
  NATSIcon,
  NGINXIcon,
  NodeJSIcon,
  PHPIcon,
  PodmanIcon,
  PostgreSQLIcon,
  PythonIcon,
  RabbitMQIcon,
  RedisIcon,
  RubyIcon,
  RustIcon,
  WireGuardIcon,
} from './brands';

// Both the Lucide re-exports (size?: string | number) and the brand icons
// (size?: number) are covered by this without re-widening either side: every
// consumer here renders with width/height, not size, so the shared type only
// needs to guarantee the SVG props are present.
type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

/*
 * Capability keys are stable "<verb>-<technology>" strings (install-postgresql,
 * restore-mongodb, enable-containers...). The technology token identifies the
 * brand mark to show. Matching is against key.split('-') tokens, not a
 * substring search -- a substring match on "go" would false-positive inside
 * "mongodb". Order doesn't matter here: every slug below is a distinct token,
 * so no two entries can both match the same key.
 */
const BRAND_MATCHERS: Array<[string, IconComponent]> = [
  ['postgresql', PostgreSQLIcon],
  ['mysql', MySQLIcon],
  ['mariadb', MariaDBIcon],
  ['mongodb', MongoDBIcon],
  ['redis', RedisIcon],
  ['rabbitmq', RabbitMQIcon],
  ['nats', NATSIcon],
  ['minio', MinIOIcon],
  ['meilisearch', MeilisearchIcon],
  ['wireguard', WireGuardIcon],
  ['k3s', K3sIcon],
  ['docker', DockerIcon],
  ['containers', DockerIcon], // "enable-containers" has no literal "docker" token but is the Docker-install capability
  ['podman', PodmanIcon],
  ['nodejs', NodeJSIcon],
  ['python', PythonIcon],
  ['php', PHPIcon],
  ['java', JavaIcon],
  ['ruby', RubyIcon],
  ['rust', RustIcon],
  ['go', GoIcon],
  ['nginx', NGINXIcon],
  ['apache', ApacheIcon],
];

const CATEGORY_FALLBACK: Record<string, IconComponent> = {
  system: Settings,
  security: Shield,
  deployment: Rocket,
  monitoring: Activity,
  backup: Download,
  database: Database,
  runtime: Cpu,
  web: Globe,
  messaging: MessageSquare,
  storage: HardDrive,
  search: Search,
  networking: Network,
  orchestration: Boxes,
};

export interface CapabilityIconInput {
  key: string;
  category: string;
}

/**
 * Picks the icon for a Capability: its technology's brand mark when the key
 * names one (memcached, haproxy and fail2ban have no simple-icons mark and
 * fall through), otherwise its category's icon, otherwise Layers.
 */
export function capabilityIcon({ key, category }: CapabilityIconInput): IconComponent {
  const tokens = key.split('-');
  const brand = BRAND_MATCHERS.find(([slug]) => tokens.includes(slug));
  if (brand) return brand[1];
  return CATEGORY_FALLBACK[category] ?? Layers;
}

/*
 * A Service's technology is identified from its image name rather than a
 * Capability key, and the two vocabularies disagree: the official images are
 * `postgres`, `mongo`, `node`, `httpd`, and `golang`, not `postgresql`,
 * `mongodb`, `nodejs`, `apache`, or `go`. So this is its own token table, not
 * a reuse of BRAND_MATCHERS, matched the same way -- exact token membership
 * after splitting on every non-alphanumeric character, not a substring
 * search, so "go" cannot false-positive inside "mongo" or "django".
 */
const IMAGE_BRAND_MATCHERS: Array<[string, IconComponent]> = [
  ['postgres', PostgreSQLIcon],
  ['postgresql', PostgreSQLIcon],
  ['mysql', MySQLIcon],
  ['mariadb', MariaDBIcon],
  ['mongo', MongoDBIcon],
  ['mongodb', MongoDBIcon],
  ['redis', RedisIcon],
  ['rabbitmq', RabbitMQIcon],
  ['nats', NATSIcon],
  ['minio', MinIOIcon],
  ['meilisearch', MeilisearchIcon],
  ['wireguard', WireGuardIcon],
  ['k3s', K3sIcon],
  ['docker', DockerIcon],
  ['podman', PodmanIcon],
  ['node', NodeJSIcon],
  ['nodejs', NodeJSIcon],
  ['python', PythonIcon],
  ['php', PHPIcon],
  ['openjdk', JavaIcon],
  ['java', JavaIcon],
  ['ruby', RubyIcon],
  ['rust', RustIcon],
  ['golang', GoIcon],
  ['nginx', NGINXIcon],
  ['httpd', ApacheIcon],
  ['apache', ApacheIcon],
];

/**
 * Picks the icon for a Service or workload from its image name (for example
 * `bitnami/redis:7-alpine` or `postgres:16`), falling back to the generic
 * Container mark when nothing matches or no image is known yet.
 */
export function serviceIcon(image?: string | null): IconComponent {
  if (!image) return Container;
  const tokens = image.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  const brand = IMAGE_BRAND_MATCHERS.find(([slug]) => tokens.includes(slug));
  return brand ? brand[1] : Container;
}
