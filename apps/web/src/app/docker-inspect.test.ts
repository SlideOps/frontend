import type { DockerHealthcheck, DockerInspect } from '@slideops/api-client';
import { describe, expect, it } from 'vitest';
import { healthSummary, inspectSections, type InspectSection } from './docker-inspect';

/*
 * How one container's detail reads.
 *
 * Most of these tests are about what is missing. A panel of a hundred rows is
 * easy; a panel that never claims a limit nobody set, never turns an absent
 * healthcheck verdict into a verdict, and never carries an environment variable
 * to a screen is the thing worth pinning, because every one of those failures
 * looks perfectly fine in a screenshot.
 */

/** Overrides are section by section, and partial within a section. */
type InspectOverrides = {
  [K in keyof DockerInspect]?: Partial<DockerInspect[K]>;
};

function inspect(over: InspectOverrides = {}): DockerInspect {
  return {
    general: {
      id: 'a'.repeat(64),
      name: '/shop-web',
      created_at: '2026-09-01T10:00:00Z',
      state: 'running',
      full_id: 'a'.repeat(64),
      status_text: 'Up 3 hours (healthy)',
      ownership: 'external' as const,
      platform: 'linux/amd64',
      runtime: 'runc',
      ...over.general,
    },
    configuration: {
      image: 'ghcr.io/acme/shop:1.4',
      command: ['node', 'server.js'],
      entrypoint: ['/docker-entrypoint.sh'],
      working_dir: '/app',
      user: 'node',
      labels: {},
      ...over.configuration,
    },
    resources: {
      cpu_limit_cores: 0,
      cpu_shares: 0,
      memory_limit_mb: 0,
      memory_reservation_mb: 0,
      pids_limit: 0,
      ...over.resources,
    },
    networking: {
      networks: [{ name: 'shop_default', ip_address: '172.19.0.2', aliases: [] }],
      ports: [],
      dns: [],
      hostname: 'shop-web',
      ...over.networking,
    },
    storage: { mounts: [], ...over.storage },
    runtime: {
      restart_policy: 'unless-stopped',
      restart_max_retries: 0,
      restart_count: 0,
      health_failing_streak: 0,
      pid: 0,
      exit_code: 0,
      oom_killed: false,
      ...over.runtime,
    },
  };
}

function section(sections: InspectSection[], key: string): InspectSection | undefined {
  return sections.find((candidate) => candidate.key === key);
}

function value(sections: InspectSection[], key: string, label: string): string | undefined {
  return section(sections, key)?.rows.find((row) => row.label === label)?.value;
}

function everyString(sections: InspectSection[]): string {
  return JSON.stringify(sections);
}

describe('the shape of the panel', () => {
  it('orders the sections the way the questions get asked', () => {
    const sections = inspectSections(
      inspect({
        configuration: {
          image: 'ghcr.io/acme/shop:1.4',
          command: ['node', 'server.js'],
          entrypoint: [],
          working_dir: '/app',
          user: '',
          labels: { owner: 'platform' },
        },
        resources: { memory_limit_mb: 512 },
        storage: {
          mounts: [
            {
              type: 'volume',
              source: '/var/lib/docker/volumes/shop_data/_data',
              destination: '/data',
              read_only: false,
              name: 'shop_data',
            },
          ],
        },
      }),
    );

    expect(sections.map((entry) => entry.key)).toEqual([
      'general',
      'configuration',
      'labels',
      'resources',
      'networking',
      'storage',
      'runtime',
    ]);
    expect(sections.map((entry) => entry.title)).toContain('Networking');
  });

  it('drops a section that has nothing in it', () => {
    // An empty "Resources" heading reads as a container with no resources
    // rather than as a container nobody set a limit on.
    const sections = inspectSections(inspect());

    expect(section(sections, 'resources')).toBeUndefined();
    expect(section(sections, 'storage')).toBeUndefined();
    expect(section(sections, 'labels')).toBeUndefined();
  });

  it('never renders an absent value as a row', () => {
    const sections = inspectSections(
      inspect({
        configuration: {
          image: 'nginx:1.27',
          command: [],
          entrypoint: [],
          working_dir: '',
          user: '   ',
          labels: {},
        },
      }),
    );

    const labels = section(sections, 'configuration')?.rows.map((row) => row.label);
    expect(labels).toEqual(['Image']);
    expect(everyString(sections)).not.toContain('undefined');
  });
});

describe('general', () => {
  it('strips the slash Docker puts in front of a name', () => {
    const sections = inspectSections(inspect());

    expect(value(sections, 'general', 'Name')).toBe('shop-web');
  });

  it("passes Docker's own status line through verbatim", () => {
    const sections = inspectSections(inspect());

    expect(value(sections, 'general', 'Status')).toBe('Up 3 hours (healthy)');
    expect(value(sections, 'general', 'State')).toBe('Running');
  });

  it('reads a created date, and says nothing when it cannot be read', () => {
    expect(value(inspectSections(inspect()), 'general', 'Created')).toContain('2026');
    expect(
      value(
        inspectSections(inspect({ general: { ...inspect().general, created_at: 'not a date' } })),
        'general',
        'Created',
      ),
    ).toBeUndefined();
  });
});

describe('resources', () => {
  it('reads limits in the units a person uses', () => {
    const sections = inspectSections(
      inspect({
        resources: {
          cpu_limit_cores: 1.5,
          cpu_shares: 1024,
          memory_limit_mb: 2048,
          memory_reservation_mb: 512,
          pids_limit: 200,
        },
      }),
    );

    expect(value(sections, 'resources', 'CPU limit')).toBe('1.5 cores');
    expect(value(sections, 'resources', 'CPU shares')).toBe('1024');
    expect(value(sections, 'resources', 'Memory limit')).toBe('2.0 GB');
    expect(value(sections, 'resources', 'Memory reservation')).toBe('512.0 MB');
    expect(value(sections, 'resources', 'Process limit')).toBe('200');
  });

  it('omits a limit reported as zero rather than calling it a limit of zero', () => {
    // Docker reports an unset limit as zero. "0 B" would read as a container
    // allowed no memory at all, which is the opposite of what it means.
    const sections = inspectSections(
      inspect({ resources: { memory_limit_mb: 0, cpu_limit_cores: 0, pids_limit: 0 } }),
    );

    expect(section(sections, 'resources')).toBeUndefined();
  });
});

describe('networking', () => {
  it('tells a published port apart from one that is only exposed', () => {
    const sections = inspectSections(
      inspect({
        networking: {
          networks: [{ name: 'shop_default', ip_address: '172.19.0.2', aliases: [] }],
          ports: [
            { host_ip: '0.0.0.0', host_port: 8080, container_port: 80, protocol: 'tcp' },
            { container_port: 5432, protocol: 'tcp' },
          ],
          dns: ['1.1.1.1', '1.0.0.1'],
          hostname: 'shop-web',
        },
      }),
    );

    expect(value(sections, 'networking', 'Port 80/tcp')).toBe('Published on 0.0.0.0:8080');
    expect(value(sections, 'networking', 'Port 5432/tcp')).toBe('Not published outside Docker');
    expect(value(sections, 'networking', 'Address on shop_default')).toBe('172.19.0.2');
    expect(value(sections, 'networking', 'DNS servers')).toBe('1.1.1.1, 1.0.0.1');
  });

  it('leaves out a DNS list nobody set', () => {
    const sections = inspectSections(inspect());

    expect(value(sections, 'networking', 'DNS servers')).toBeUndefined();
    expect(value(sections, 'networking', 'Networks')).toBe('shop_default');
  });
});

describe('storage', () => {
  it('says what is behind each mount and whether it can be written', () => {
    const sections = inspectSections(
      inspect({
        storage: {
          mounts: [
            {
              type: 'volume',
              source: '/var/lib/docker/volumes/shop_data/_data',
              destination: '/var/lib/postgresql/data',
              read_only: false,
              name: 'shop_data',
            },
            {
              type: 'bind',
              source: '/etc/nginx/nginx.conf',
              destination: '/etc/nginx/nginx.conf',
              read_only: true,
            },
          ],
        },
      }),
    );

    expect(value(sections, 'storage', '/var/lib/postgresql/data')).toBe(
      'Volume shop_data, read-write',
    );
    expect(value(sections, 'storage', '/etc/nginx/nginx.conf')).toBe(
      'Bind /etc/nginx/nginx.conf, read-only',
    );
  });
});

describe('runtime', () => {
  it('keeps a zero that was reported and drops a flag that was not raised', () => {
    const sections = inspectSections(inspect({ runtime: { ...inspect().runtime, exit_code: 0 } }));

    // Zero restarts and a clean exit are both answers, so both are shown.
    expect(value(sections, 'runtime', 'Restarts')).toBe('0');
    expect(value(sections, 'runtime', 'Exit code')).toBe('0');
    // A container that was not OOM killed gets no row saying so.
    expect(value(sections, 'runtime', 'Killed for memory')).toBeUndefined();
    expect(value(sections, 'runtime', 'Process ID')).toBeUndefined();
  });

  it('says when the kernel stopped the container', () => {
    const sections = inspectSections(
      inspect({ runtime: { ...inspect().runtime, oom_killed: true, exit_code: 137, pid: 0 } }),
    );

    expect(value(sections, 'runtime', 'Killed for memory')).toContain('Yes');
    expect(value(sections, 'runtime', 'Exit code')).toBe('137');
  });

  it("shows the healthcheck command without Docker's dispatch token", () => {
    const sections = inspectSections(
      inspect({
        runtime: {
          ...inspect().runtime,
          health: 'healthy',
          healthcheck: {
            test: ['CMD-SHELL', 'curl -f http://localhost/health'],
            interval_seconds: 90,
            retries: 3,
          },
        },
      }),
    );

    expect(value(sections, 'runtime', 'Healthcheck')).toBe('curl -f http://localhost/health');
    // Not "1m": the difference between every 90 seconds and every minute is the
    // whole setting.
    expect(value(sections, 'runtime', 'Check interval')).toBe('1m 30s');
    expect(value(sections, 'runtime', 'Check retries')).toBe('3');
    expect(value(sections, 'runtime', 'Last check')).toBe('healthy');
  });
});

describe('healthSummary', () => {
  function withHealthcheck(over: Partial<DockerHealthcheck> = {}, health?: string): DockerInspect {
    const base = inspect();
    return inspect({
      runtime: {
        ...base.runtime,
        health,
        healthcheck: { test: ['CMD', 'curl', '-f', 'http://localhost/'], ...over },
      },
    });
  }

  it('says nothing at all when the image declares no healthcheck', () => {
    // Not "healthy", and not a warning either. Nobody is checking, and silence
    // is the only honest rendering of that.
    expect(healthSummary(inspect())).toBeNull();
  });

  it('treats Docker’s explicit NONE as no healthcheck', () => {
    expect(healthSummary(withHealthcheck({ test: ['NONE'] }))).toBeNull();
    expect(healthSummary(withHealthcheck({ test: [] }))).toBeNull();
  });

  it('does not invent a verdict when Docker has reported none', () => {
    const summary = healthSummary(withHealthcheck({ interval_seconds: 30 }));

    expect(summary).toContain('has not reported a result yet');
    expect(summary).not.toContain('healthy');
    expect(summary).toContain('every 30s');
  });

  it('reports the verdict Docker did give', () => {
    expect(healthSummary(withHealthcheck({}, 'healthy'))).toContain('passed');
    expect(healthSummary(withHealthcheck({}, 'unhealthy'))).toContain('failed');
    expect(healthSummary(withHealthcheck({}, 'starting'))).toContain('start-up grace period');
  });

  it('quotes a verdict nobody here anticipated instead of swallowing it', () => {
    expect(healthSummary(withHealthcheck({}, 'degraded'))).toContain('"degraded"');
  });
});

describe('what must never reach the screen', () => {
  it('carries no environment, under any label', () => {
    // There is no environment in the contract and there must be none in the
    // output: a container's environment is where its passwords live, and this
    // panel is a screen that gets left open and screen shared.
    const sections = inspectSections(
      inspect({
        configuration: {
          image: 'postgres:16',
          command: ['postgres'],
          entrypoint: ['docker-entrypoint.sh'],
          working_dir: '/',
          user: 'postgres',
          labels: { owner: 'platform' },
        },
      }),
    );

    expect(everyString(sections)).not.toMatch(/environment/i);
    expect(sections.flatMap((entry) => entry.rows.map((row) => row.label))).not.toContain(
      'Environment',
    );
  });

  it('never writes a dash this project forbids, and speaks of the Operator', () => {
    const sections = inspectSections(
      inspect({
        runtime: {
          restart_policy: 'always',
          restart_count: 3,
          oom_killed: true,
          health: 'unhealthy',
          healthcheck: { test: ['CMD', 'true'], interval_seconds: 10 },
        },
      }),
    );
    const rendered = `${everyString(sections)}${healthSummary(inspect()) ?? ''}`;

    expect(rendered).not.toMatch(/[\u2013\u2014]/);
    // "User" survives as a configuration label because it is Docker's own field
    // for the Unix account a container runs as. No sentence here refers to a
    // person as a user; that person is the Operator.
    const sentences = [
      healthSummary(inspect()) ?? '',
      healthSummary(
        inspect({
          runtime: {
            restart_policy: 'always',
            restart_count: 0,
            oom_killed: false,
            healthcheck: { test: ['CMD', 'true'] },
            health: 'unhealthy',
          },
        }),
      ) ?? '',
      ...sections.flatMap((entry) => entry.rows.map((row) => row.value)),
    ].join(' ');
    expect(sentences).not.toMatch(/\busers?\b/i);
  });
});
