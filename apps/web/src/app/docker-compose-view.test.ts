import type { DockerComposeDiff, DockerInspect } from '@slideops/api-client';
import { describe, expect, it } from 'vitest';
import {
  MAX_DEPENDENCY_CHAINS,
  REDACTED_ENV_PLACEHOLDER,
  REDACTION_NOTICE,
  bulkActionLabel,
  cloneRequestFromInspect,
  composeApplyGate,
  composeServiceSnippet,
  dependencyGraph,
  exportSourceFromInspect,
  formatDependencyChain,
  isDestructiveBulkAction,
  runCommand,
  summariseBulkOutcomes,
  summariseComposeDiff,
  type ExportSource,
} from './docker-compose-view';

/*
 * The rules that must not drift.
 *
 * Three of these tests are the whole reason the module exists: a dependency
 * cycle must be reported rather than walked into, a diff that removes a volume
 * must block an apply until somebody says so out loud, and an export must not
 * carry environment values unless it was asked to.
 */

function diff(overrides: Partial<DockerComposeDiff> = {}): DockerComposeDiff {
  return {
    containers_recreated: [],
    images_changed: [],
    networks_added: [],
    networks_removed: [],
    volumes_added: [],
    volumes_removed: [],
    ...overrides,
  };
}

function source(overrides: Partial<ExportSource> = {}): ExportSource {
  return {
    name: 'shop-web',
    image: 'nginx:1.27',
    ports: [],
    env: {},
    mounts: [],
    networks: [],
    dns: [],
    labels: {},
    ...overrides,
  };
}

function inspect(overrides: Partial<DockerInspect> = {}): DockerInspect {
  return {
    general: {
      id: 'abc123',
      name: '/shop-web',
      created_at: '2026-01-01T00:00:00Z',
      state: 'running',
      status: 'Up 3 hours',
      platform: 'linux',
      runtime: 'runc',
    },
    configuration: {
      image: 'nginx:1.27',
      command: '',
      entrypoint: '',
      working_dir: '',
      user: '',
      labels: {},
    },
    resources: {},
    networking: { networks: [], ip_addresses: {}, ports: [], dns: [], hostname: 'shop-web' },
    storage: { mounts: [] },
    runtime: { restart_policy: 'no', restart_count: 0, oom_killed: false },
    ...overrides,
  };
}

describe('the dependency graph', () => {
  it('orders services so every dependency starts before what needs it', () => {
    const graph = dependencyGraph([
      { name: 'frontend', depends_on: ['backend'] },
      { name: 'backend', depends_on: ['postgres'] },
      { name: 'postgres', depends_on: [] },
    ]);

    expect(graph.cycle).toBeNull();
    expect(graph.order).toEqual(['postgres', 'backend', 'frontend']);
    expect(graph.levels).toEqual([['postgres'], ['backend'], ['frontend']]);
  });

  it('reads out as a chain an Operator can follow', () => {
    const graph = dependencyGraph([
      { name: 'frontend', depends_on: ['backend'] },
      { name: 'backend', depends_on: ['postgres'] },
      { name: 'postgres', depends_on: [] },
    ]);

    expect(graph.chains.map(formatDependencyChain)).toEqual(['frontend -> backend -> postgres']);
  });

  it('reports a cycle instead of walking round it forever', () => {
    const graph = dependencyGraph([
      { name: 'api', depends_on: ['worker'] },
      { name: 'worker', depends_on: ['api'] },
    ]);

    expect(graph.cycle).not.toBeNull();
    expect(formatDependencyChain(graph.cycle ?? [])).toBe('api -> worker -> api');
    // No order is claimed, because with a cycle there is not one.
    expect(graph.order).toEqual([]);
    expect(graph.chains).toEqual([]);
  });

  it('reports a service that depends on itself as the cycle it is', () => {
    const graph = dependencyGraph([{ name: 'api', depends_on: ['api'] }]);

    expect(formatDependencyChain(graph.cycle ?? [])).toBe('api -> api');
  });

  it('finds a cycle that sits behind a sound part of the stack', () => {
    const graph = dependencyGraph([
      { name: 'web', depends_on: ['api'] },
      { name: 'api', depends_on: ['queue'] },
      { name: 'queue', depends_on: ['api'] },
    ]);

    expect(graph.cycle).not.toBeNull();
    expect(graph.cycle).toContain('api');
    expect(graph.cycle).toContain('queue');
  });

  it('reports a depends_on naming a service the stack does not define', () => {
    const graph = dependencyGraph([{ name: 'web', depends_on: ['redis'] }]);

    expect(graph.missing).toEqual([{ service: 'web', dependsOn: 'redis' }]);
    // The unknown name is not invented as a node in the order.
    expect(graph.order).toEqual(['web']);
  });

  it('handles a stack whose services depend on nothing', () => {
    const graph = dependencyGraph([
      { name: 'b', depends_on: [] },
      { name: 'a', depends_on: [] },
    ]);

    expect(graph.order).toEqual(['a', 'b']);
    expect(graph.chains.map(formatDependencyChain)).toEqual(['a', 'b']);
  });

  it('says so rather than listing forever when a stack fans out very wide', () => {
    const leaves = Array.from({ length: 40 }, (_, index) => ({
      name: `leaf-${index}`,
      depends_on: [],
    }));
    const graph = dependencyGraph([
      { name: 'root', depends_on: leaves.map((leaf) => leaf.name) },
      ...leaves,
    ]);

    expect(graph.chains).toHaveLength(MAX_DEPENDENCY_CHAINS);
    expect(graph.chainsTruncated).toBe(true);
  });

  it('returns an empty graph for an empty stack rather than throwing', () => {
    const graph = dependencyGraph([]);

    expect(graph).toEqual({
      order: [],
      levels: [],
      chains: [],
      chainsTruncated: false,
      cycle: null,
      missing: [],
    });
  });
});

describe('summarising a Compose diff', () => {
  it('keeps removed volumes out of the ordinary groups', () => {
    const summary = summariseComposeDiff(
      diff({ volumes_removed: ['shop_pgdata'], images_changed: ['nginx:1.27'] }),
    );

    expect(summary.destroysData).toBe(true);
    expect(summary.volumesRemoved).toEqual(['shop_pgdata']);
    expect(summary.groups.map((group) => group.key)).toEqual(['images_changed']);
    expect(summary.changeCount).toBe(2);
  });

  it('reports a diff that changes nothing as empty and harmless', () => {
    const summary = summariseComposeDiff(diff());

    expect(summary.empty).toBe(true);
    expect(summary.destroysData).toBe(false);
    expect(summary.groups).toEqual([]);
  });

  it('does not call adding a volume destructive', () => {
    const summary = summariseComposeDiff(diff({ volumes_added: ['shop_cache'] }));

    expect(summary.destroysData).toBe(false);
    expect(summary.groups.map((group) => group.key)).toEqual(['volumes_added']);
  });
});

describe('the gate in front of Apply', () => {
  it('refuses until a diff has actually been seen', () => {
    const gate = composeApplyGate({ diff: null, dataLossConfirmed: false, canWrite: true });

    expect(gate.allowed).toBe(false);
    expect(gate.allowed === false && gate.reason).toContain('Run the diff first');
  });

  it('blocks a diff that removes a volume until the data loss is confirmed', () => {
    const removing = diff({ volumes_removed: ['shop_pgdata'] });

    const blocked = composeApplyGate({
      diff: removing,
      dataLossConfirmed: false,
      canWrite: true,
    });
    expect(blocked.allowed).toBe(false);
    expect(blocked.allowed === false && blocked.reason).toContain('1 volume');

    const confirmed = composeApplyGate({
      diff: removing,
      dataLossConfirmed: true,
      canWrite: true,
    });
    expect(confirmed.allowed).toBe(true);
  });

  it('lets a diff that removes no volume through without any confirmation', () => {
    const gate = composeApplyGate({
      diff: diff({ containers_recreated: ['shop-web-1'] }),
      dataLossConfirmed: false,
      canWrite: true,
    });

    expect(gate.allowed).toBe(true);
  });

  it('refuses outright for an Operator whose role cannot write', () => {
    const gate = composeApplyGate({ diff: diff(), dataLossConfirmed: true, canWrite: false });

    expect(gate.allowed).toBe(false);
    expect(gate.allowed === false && gate.reason).toContain('read only');
  });
});

describe('reporting a bulk run', () => {
  it('never calls a partial failure a success', () => {
    const report = summariseBulkOutcomes('stop', [
      { name: 'web', ok: true },
      { name: 'api', ok: true },
      { name: 'db', ok: false, message: 'a Service manages this container' },
    ]);

    expect(report.allSucceeded).toBe(false);
    expect(report.headline).toBe('Stopped 2 of 3 containers. 1 container failed.');
    expect(report.failed).toHaveLength(1);
    expect(report.succeeded).toEqual(['web', 'api']);
  });

  it('reports a clean run plainly', () => {
    const report = summariseBulkOutcomes('restart', [
      { name: 'web', ok: true },
      { name: 'api', ok: true },
    ]);

    expect(report.allSucceeded).toBe(true);
    expect(report.headline).toBe('Restarted 2 containers.');
  });

  it('says when nothing at all worked', () => {
    const report = summariseBulkOutcomes('remove', [{ name: 'web', ok: false, message: 'refused' }]);

    expect(report.allSucceeded).toBe(false);
    expect(report.headline).toContain('None of the 1 container');
  });

  it('treats removal, and only removal, as the destructive bulk action', () => {
    expect(isDestructiveBulkAction('remove')).toBe(true);
    expect(isDestructiveBulkAction('stop')).toBe(false);
    expect(bulkActionLabel('unpause')).toBe('Resume');
  });
});

describe('exporting a container', () => {
  it('replaces every environment value with a placeholder by default', () => {
    const exported = source({ env: { POSTGRES_PASSWORD: 'hunter2', LOG_LEVEL: 'debug' } });

    const command = runCommand(exported);
    const snippet = composeServiceSnippet(exported);

    expect(command).not.toContain('hunter2');
    expect(command).not.toContain('debug');
    expect(command).toContain(REDACTED_ENV_PLACEHOLDER);
    expect(snippet).not.toContain('hunter2');
    expect(snippet).toContain(REDACTED_ENV_PLACEHOLDER);
  });

  it('carries a notice with the redacted text, since the text outlives the screen', () => {
    const exported = source({ env: { POSTGRES_PASSWORD: 'hunter2' } });

    expect(runCommand(exported).startsWith(REDACTION_NOTICE)).toBe(true);
    expect(composeServiceSnippet(exported).startsWith(REDACTION_NOTICE)).toBe(true);
  });

  it('includes the real values only when the Operator opted in', () => {
    const exported = source({ env: { POSTGRES_PASSWORD: 'hunter2' } });

    const command = runCommand(exported, { includeSecrets: true });

    expect(command).toContain('hunter2');
    expect(command).not.toContain(REDACTED_ENV_PLACEHOLDER);
    expect(command).not.toContain(REDACTION_NOTICE);
  });

  it('adds no redaction notice when there was no environment to redact', () => {
    expect(runCommand(source())).not.toContain(REDACTION_NOTICE);
    expect(composeServiceSnippet(source())).not.toContain(REDACTION_NOTICE);
  });

  it('writes a run command an Operator can read back', () => {
    const command = runCommand(
      source({
        restartPolicy: 'unless-stopped',
        ports: [{ host_ip: '127.0.0.1', host_port: 8080, container_port: 80, protocol: 'tcp' }],
        mounts: [
          {
            type: 'volume',
            source: '/var/lib/docker/volumes/shop_pgdata/_data',
            destination: '/var/lib/postgresql/data',
            read_only: false,
            name: 'shop_pgdata',
          },
        ],
        cpuLimitCores: 1.5,
        memoryLimitMb: 512,
        healthcheck: { test: ['CMD-SHELL', 'curl -f localhost/health'], interval_seconds: 30, retries: 3 },
      }),
    );

    expect(command).toContain('docker run -d');
    expect(command).toContain('--name shop-web');
    expect(command).toContain('--restart unless-stopped');
    expect(command).toContain('-p 127.0.0.1:8080:80');
    // The named volume, not the path on the Node it happens to live at.
    expect(command).toContain('-v shop_pgdata:/var/lib/postgresql/data');
    expect(command).toContain('--cpus 1.5');
    expect(command).toContain('--memory 512m');
    expect(command).toContain("--health-cmd 'curl -f localhost/health'");
    expect(command).toContain('nginx:1.27');
  });

  it('writes a Compose service that nests under services:', () => {
    const snippet = composeServiceSnippet(
      source({
        restartPolicy: 'always',
        networks: ['shop_default'],
        ports: [{ host_port: 8080, container_port: 80, protocol: 'tcp' }],
      }),
    );

    expect(snippet.split('\n')[0]).toBe('services:');
    expect(snippet).toContain('  shop-web:');
    // Quoted, because a tag separator in a plain scalar is exactly the kind of
    // thing a hand-written emitter should not be clever about.
    expect(snippet).toContain('    image: "nginx:1.27"');
    expect(snippet).toContain('    restart: always');
    expect(snippet).toContain('      - "8080:80"');
    expect(snippet).toContain('      - shop_default');
  });

  it('exposes rather than publishes a port with no host binding', () => {
    const command = runCommand(
      source({ ports: [{ container_port: 5432, protocol: 'tcp' }] }),
    );

    expect(command).toContain('--expose 5432');
    expect(command).not.toContain('-p ');
  });

  it('builds an export source from an inspect, which carries no environment', () => {
    const exported = exportSourceFromInspect(
      inspect({
        general: { ...inspect().general, name: '/shop-web' },
        runtime: { restart_policy: 'unless-stopped', restart_count: 2, oom_killed: false },
      }),
    );

    // The leading slash Docker puts on a container name is not part of it.
    expect(exported.name).toBe('shop-web');
    expect(exported.restartPolicy).toBe('unless-stopped');
    expect(exported.env).toEqual({});
  });

  it('drops the restart policy Docker reports for a container that has none', () => {
    expect(exportSourceFromInspect(inspect()).restartPolicy).toBeUndefined();
  });
});

describe('cloning a container', () => {
  const original = inspect({
    configuration: {
      image: 'nginx:1.27',
      command: 'nginx -g "daemon off;"',
      entrypoint: '',
      working_dir: '/app',
      user: '1000:1000',
      labels: { team: 'platform' },
    },
    resources: { cpu_limit_cores: 1, memory_limit_mb: 256 },
    networking: {
      networks: ['shop_default'],
      ip_addresses: { shop_default: '172.18.0.3' },
      ports: [{ host_port: 8080, container_port: 80, protocol: 'tcp' }],
      dns: ['1.1.1.1'],
      hostname: 'shop-web',
    },
    storage: {
      mounts: [
        {
          type: 'volume',
          source: '/var/lib/docker/volumes/shop_pgdata/_data',
          destination: '/var/lib/postgresql/data',
          read_only: false,
          name: 'shop_pgdata',
        },
      ],
    },
    runtime: { restart_policy: 'unless-stopped', restart_count: 7, oom_killed: true, exit_code: 137 },
  });

  it('copies configuration and nothing that would collide or leak', () => {
    const { request } = cloneRequestFromInspect(original);

    expect(request.image).toBe('nginx:1.27');
    expect(request.working_dir).toBe('/app');
    expect(request.user).toBe('1000:1000');
    expect(request.restart_policy).toBe('unless-stopped');
    expect(request.network).toBe('shop_default');
    expect(request.labels).toEqual({ team: 'platform' });
    // No name: two containers cannot share one.
    expect(request.name).toBeUndefined();
    // No environment, because none was ever carried to the browser.
    expect(request.env).toBeUndefined();
    // No storage: a clone must not write into the data of the original.
    expect(request.volumes).toBeUndefined();
  });

  it('keeps the container port but not the host binding the original still holds', () => {
    const { request } = cloneRequestFromInspect(original);

    expect(request.ports).toEqual([{ container_port: 80, protocol: 'tcp' }]);
  });

  it('says which parts were not copied', () => {
    const { omitted } = cloneRequestFromInspect(original);
    const said = omitted.join(' ');

    expect(said).toContain('name');
    expect(said).toContain('Environment variables');
    expect(said).toContain('Volumes and bind mounts');
    expect(said).toContain('Published host ports');
    expect(said).toContain('Runtime state');
  });

  it('does not mention storage or ports it had nothing to omit', () => {
    const { omitted } = cloneRequestFromInspect(inspect());
    const said = omitted.join(' ');

    expect(said).not.toContain('Volumes and bind mounts');
    expect(said).not.toContain('Published host ports');
  });
});
