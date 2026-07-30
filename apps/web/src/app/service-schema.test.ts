import { describe, expect, it } from 'vitest';
import {
  buildServiceSchema,
  parseEnv,
  parsePorts,
  toDeployInput,
  type ServiceFormValues,
} from './service-schema';

/** A complete, valid set of form values to override from. */
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
  it('accepts a valid image deploy', () => {
    expect(buildServiceSchema().safeParse(values()).success).toBe(true);
  });

  it('accepts any CPU and memory the Operator chooses on their own server', () => {
    // Resources are the Operator's, not a tier cap, so a large limit is valid.
    expect(
      buildServiceSchema().safeParse(values({ cpu_limit: 32, memory_mb: 131072 })).success,
    ).toBe(true);
  });

  it('still enforces a sane minimum on the limits', () => {
    expect(buildServiceSchema().safeParse(values({ cpu_limit: 0 })).success).toBe(false);
    expect(buildServiceSchema().safeParse(values({ memory_mb: 4 })).success).toBe(false);
  });

  it('requires an image when the source is an image', () => {
    const result = buildServiceSchema().safeParse(values({ source_type: 'image', image: '' }));
    expect(result.success).toBe(false);
  });

  it('requires a repository url when the source is a repository', () => {
    const result = buildServiceSchema().safeParse(
      values({ source_type: 'repository', image: '', repository_url: '' }),
    );
    expect(result.success).toBe(false);
  });

  it('requires a command for a systemd runtime', () => {
    const result = buildServiceSchema().safeParse(values({ runtime: 'systemd', command: '' }));
    expect(result.success).toBe(false);
  });

  it('rejects a name with invalid characters', () => {
    expect(buildServiceSchema().safeParse(values({ name: 'Web Service' })).success).toBe(false);
    expect(buildServiceSchema().safeParse(values({ name: 'web-1' })).success).toBe(true);
  });

  it('flags malformed port mappings', () => {
    expect(buildServiceSchema().safeParse(values({ ports: '8080:80' })).success).toBe(true);
    expect(buildServiceSchema().safeParse(values({ ports: 'not-a-port' })).success).toBe(false);
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

  // A bare port is the container port, and SlideOps chooses the public one. That
  // is the default the form offers, because picking public ports by hand is how
  // two applications on one server end up fighting over the same one.
  it('reads a bare port as the container port with the public port left to SlideOps', () => {
    expect(parsePorts('80')).toEqual({ ports: [{ host: 0, container: 80 }] });
  });

  it('reports an error for a line that is neither form', () => {
    expect(parsePorts('80:90:100').error).toBeTruthy();
    expect(parsePorts('web').error).toBeTruthy();
  });
});

describe('parseEnv', () => {
  // An array, not a map: each entry carries its own secret flag, which is the
  // shape the API has always taken. The map this used to produce was rejected
  // outright, so every deploy that set a variable failed with "the request body
  // was not valid" while deploys with none worked.
  it('parses KEY=value lines into entries the API accepts', () => {
    expect(parseEnv('NODE_ENV=production\nPORT=80')).toEqual({
      env: [
        { key: 'NODE_ENV', value: 'production', secret: false },
        { key: 'PORT', value: '80', secret: false },
      ],
    });
  });

  it('seals a line prefixed with the secret marker', () => {
    expect(parseEnv('DATABASE_URL=postgres://x\nsecret:SECRET_ENCRYPTION_KEY=abc')).toEqual({
      env: [
        { key: 'DATABASE_URL', value: 'postgres://x', secret: false },
        { key: 'SECRET_ENCRYPTION_KEY', value: 'abc', secret: true },
      ],
    });
  });

  // Sealing is explicit. Guessing from the name would either miss a secret or
  // silently make a value the Operator needs unreadable forever.
  it('does not guess that a value is secret from its name', () => {
    expect(parseEnv('SECRET_ENCRYPTION_KEY=abc').env).toEqual([
      { key: 'SECRET_ENCRYPTION_KEY', value: 'abc', secret: false },
    ]);
  });

  it('keeps a value containing an equals sign intact', () => {
    expect(parseEnv('DSN=host=db user=api').env).toEqual([
      { key: 'DSN', value: 'host=db user=api', secret: false },
    ]);
  });

  it('rejects an invalid variable name', () => {
    expect(parseEnv('1BAD=value').error).toBeTruthy();
  });

  it('rejects the same variable set twice', () => {
    expect(parseEnv('PORT=80\nPORT=443').error).toBeTruthy();
  });

  it('parses nothing from an empty field', () => {
    expect(parseEnv('')).toEqual({ env: [] });
    expect(parseEnv(undefined)).toEqual({ env: [] });
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
    // The array shape the API takes. This assertion previously encoded the map
    // shape, which is how the mismatch went unnoticed: the test agreed with the
    // client and neither agreed with the server.
    expect(input.env).toEqual([{ key: 'NODE_ENV', value: 'production', secret: false }]);
    expect(input.pids_limit).toBe(128);
  });
});
