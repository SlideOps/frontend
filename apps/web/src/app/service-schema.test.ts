import { describe, expect, it } from 'vitest';
import {
  buildServiceSchema,
  parseEnv,
  parsePorts,
  toDeployInput,
  type ServiceFormValues,
} from './service-schema';

/** A complete, valid set of form values with generous headroom to override from. */
function values(over: Partial<ServiceFormValues> = {}): ServiceFormValues {
  return {
    project_id: 'pr_1',
    node_id: 'nd_1',
    name: 'web',
    runtime: 'container',
    source_type: 'image',
    image: 'nginx:latest',
    repository_url: '',
    build: '',
    command: '',
    cpu_limit: 0.5,
    memory_mb: 256,
    pids_limit: '',
    env: '',
    ports: '',
    ...over,
  } as ServiceFormValues;
}

describe('buildServiceSchema', () => {
  it('accepts a valid image deploy within quota', () => {
    const schema = buildServiceSchema({ vcpu: 2, memory_mb: 4096 });
    expect(schema.safeParse(values()).success).toBe(true);
  });

  it('rejects a CPU limit over the remaining quota', () => {
    const schema = buildServiceSchema({ vcpu: 1, memory_mb: 4096 });
    const result = schema.safeParse(values({ cpu_limit: 2 }));
    expect(result.success).toBe(false);
  });

  it('rejects a memory limit over the remaining quota', () => {
    const schema = buildServiceSchema({ vcpu: 8, memory_mb: 512 });
    const result = schema.safeParse(values({ memory_mb: 1024 }));
    expect(result.success).toBe(false);
  });

  it('requires an image when the source is an image', () => {
    const schema = buildServiceSchema({ vcpu: 8, memory_mb: 8192 });
    const result = schema.safeParse(values({ source_type: 'image', image: '' }));
    expect(result.success).toBe(false);
  });

  it('requires a repository url when the source is a repository', () => {
    const schema = buildServiceSchema({ vcpu: 8, memory_mb: 8192 });
    const result = schema.safeParse(
      values({ source_type: 'repository', image: '', repository_url: '' }),
    );
    expect(result.success).toBe(false);
  });

  it('requires a command for a systemd runtime', () => {
    const schema = buildServiceSchema({ vcpu: 8, memory_mb: 8192 });
    const result = schema.safeParse(values({ runtime: 'systemd', command: '' }));
    expect(result.success).toBe(false);
  });

  it('rejects a name with invalid characters', () => {
    const schema = buildServiceSchema({ vcpu: 8, memory_mb: 8192 });
    expect(schema.safeParse(values({ name: 'Web Service' })).success).toBe(false);
    expect(schema.safeParse(values({ name: 'web-1' })).success).toBe(true);
  });

  it('flags malformed port mappings', () => {
    const schema = buildServiceSchema({ vcpu: 8, memory_mb: 8192 });
    expect(schema.safeParse(values({ ports: '8080:80' })).success).toBe(true);
    expect(schema.safeParse(values({ ports: 'not-a-port' })).success).toBe(false);
  });
});

describe('parsePorts', () => {
  it('parses host:container lines into numbers', () => {
    expect(parsePorts('8080:80\n5432:5432')).toEqual({
      ports: [
        { host: 8080, container: 80 },
        { host: 5432, container: 5432 },
      ],
    });
  });

  it('reports an error for a bad line', () => {
    expect(parsePorts('80').error).toBeTruthy();
  });
});

describe('parseEnv', () => {
  it('parses KEY=value lines into an object', () => {
    expect(parseEnv('NODE_ENV=production\nPORT=80')).toEqual({
      env: { NODE_ENV: 'production', PORT: '80' },
    });
  });

  it('rejects an invalid variable name', () => {
    expect(parseEnv('1BAD=value').error).toBeTruthy();
  });
});

describe('toDeployInput', () => {
  it('builds an image deploy input, dropping empty optionals', () => {
    const input = toDeployInput(values({ image: 'redis:7', ports: '6379:6379' }));
    expect(input.source).toEqual({ type: 'image', image: 'redis:7', command: undefined });
    expect(input.ports).toEqual([{ host: 6379, container: 6379 }]);
    expect(input.env).toBeUndefined();
    expect(input.pids_limit).toBeUndefined();
  });

  it('builds a repository deploy input with a command and env', () => {
    const input = toDeployInput(
      values({
        source_type: 'repository',
        image: '',
        repository_url: 'https://example.com/app.git',
        command: 'node server.js',
        env: 'NODE_ENV=production',
        pids_limit: 128,
      }),
    );
    expect(input.source.type).toBe('repository');
    expect(input.source.repository_url).toBe('https://example.com/app.git');
    expect(input.source.command).toBe('node server.js');
    expect(input.env).toEqual({ NODE_ENV: 'production' });
    expect(input.pids_limit).toBe(128);
  });
});
