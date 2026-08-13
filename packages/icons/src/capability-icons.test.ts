import { describe, expect, it } from 'vitest';
import { Activity, Boxes, Layers, Shield } from './index';
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
import { capabilityIcon } from './capability-icons';

/*
 * Capability keys are "<verb>-<technology>" strings. capabilityIcon matches
 * the technology token to a brand mark, falling back to the category and
 * then to Layers. The token match must be exact-token, not substring -- see
 * the "go" vs "mongodb" case below, which is the bug this module exists to
 * prevent.
 */
describe('capabilityIcon', () => {
  it('resolves install-postgresql to the PostgreSQL brand mark', () => {
    expect(capabilityIcon({ key: 'install-postgresql', category: 'database' })).toBe(PostgreSQLIcon);
  });

  const brandCases: Array<[string, string, unknown]> = [
    ['install-mysql', 'database', MySQLIcon],
    ['install-mariadb', 'database', MariaDBIcon],
    ['install-mongodb', 'database', MongoDBIcon],
    ['install-redis', 'database', RedisIcon],
    ['install-rabbitmq', 'messaging', RabbitMQIcon],
    ['install-nats', 'messaging', NATSIcon],
    ['install-minio', 'storage', MinIOIcon],
    ['install-meilisearch', 'search', MeilisearchIcon],
    ['configure-wireguard', 'networking', WireGuardIcon],
    ['install-k3s', 'orchestration', K3sIcon],
    ['install-docker-compose', 'deployment', DockerIcon],
    ['install-podman', 'runtime', PodmanIcon],
    ['install-nodejs', 'runtime', NodeJSIcon],
    ['install-python', 'runtime', PythonIcon],
    ['install-php', 'runtime', PHPIcon],
    ['install-java', 'runtime', JavaIcon],
    ['install-ruby', 'runtime', RubyIcon],
    ['install-rust', 'runtime', RustIcon],
    ['install-go', 'runtime', GoIcon],
    ['configure-nginx', 'web', NGINXIcon],
    ['configure-apache', 'web', ApacheIcon],
  ];

  it.each(brandCases)('resolves %s to its brand mark', (key, category, expected) => {
    expect(capabilityIcon({ key, category })).toBe(expected);
  });

  it('resolves restore-mongodb to MongoDBIcon, not GoIcon (no substring match on "go")', () => {
    expect(capabilityIcon({ key: 'restore-mongodb', category: 'database' })).toBe(MongoDBIcon);
    expect(capabilityIcon({ key: 'restore-mongodb', category: 'database' })).not.toBe(GoIcon);
  });

  it('resolves enable-containers to DockerIcon via the special-cased "containers" token', () => {
    expect(capabilityIcon({ key: 'enable-containers', category: 'deployment' })).toBe(DockerIcon);
  });

  it('falls back to the category icon when the key names no brand', () => {
    expect(capabilityIcon({ key: 'enable-monitoring', category: 'monitoring' })).toBe(Activity);
    expect(capabilityIcon({ key: 'harden-firewall', category: 'security' })).toBe(Shield);
    expect(capabilityIcon({ key: 'plan-cluster', category: 'orchestration' })).toBe(Boxes);
  });

  it('falls back to Layers when neither a brand nor a known category matches', () => {
    expect(capabilityIcon({ key: 'do-something', category: 'unknown-category' })).toBe(Layers);
  });
});
