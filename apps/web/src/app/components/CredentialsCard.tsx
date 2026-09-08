import { revealOperationSecret, type Operation } from '@slideops/api-client';
import { Button, Card, Text } from '@slideops/design-system';
import { Check, Copy, Download, Eye, EyeOff, KeyRound } from '@slideops/icons';
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import {
  buildConnectionUrl,
  buildSshSignIn,
  connectionUrlTemplate,
  resolveEndpoint,
  type ResolvedEndpoint,
} from './connection-endpoint';
import { CopyButton } from './CopyButton';
import { RevealValue } from './RevealValue';

/**
 * The literal a secret parameter carries in an Operation's `parameters`. A
 * parameter is secret, and revealable, exactly when its value is this string;
 * the plaintext lives only behind the reveal endpoint, never in the record.
 */
const SECRET_PLACEHOLDER = '[stored securely]';

/**
 * The masked stand-in for a secret inside a connection template, used for the
 * addresses the server did not resolve for itself. The server sends the mark it
 * used in its own URL, so the two read identically; this is only the fallback
 * for a response that carried none.
 */
const MASKED_SECRET = '••••••';

/**
 * The non-secret parameters that read as connection details, in the order an
 * Operator scans them. Only those actually present on an Operation are shown.
 * Used when the Capability is not a known service, so the card still surfaces
 * whatever connection details exist.
 */
const CONNECTION_KEYS = [
  'database',
  'username',
  'user',
  'host',
  'hostname',
  'address',
  'port',
] as const;

/** Operator-facing names for the parameters we surface; others are humanized. */
const LABELS: Record<string, string> = {
  database: 'Database',
  username: 'Username',
  user: 'User',
  host: 'Host',
  hostname: 'Hostname',
  address: 'Address',
  port: 'Port',
  password: 'Password',
  secret: 'Secret',
  token: 'Token',
  api_key: 'API key',
  connection_string: 'Connection string',
};

/** A readable label for a parameter key, in Operator language. */
function labelFor(key: string): string {
  return LABELS[key] ?? key.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
}

interface PlainRow {
  key: string;
  label: string;
  value: string;
}

/** One labelled row in the credentials list. */
function CredentialRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1 py-3 first:pt-0 last:pb-0 sm:grid-cols-[8rem_1fr] sm:items-center sm:gap-3">
      <dt className="text-xs font-medium text-ink-muted">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}

const COPIED_RESET_MS = 1500;
const CONNECTION_ERROR = 'Could not build the connection string. Try again.';

/**
 * The ready to copy connection string for a data store, masked until asked for.
 * The Operator sees the URL with the secret hidden; revealing fetches the secret
 * lazily, assembles the full URL, shows it, and copies it in one action, so the
 * plaintext enters the DOM and the clipboard only on demand.
 */
function ConnectionString({
  template,
  build,
}: {
  /** The URL to show: masked where a password exists, whole where none does. */
  template: string;
  /**
   * Fetch the secret and assemble the full URL; called at most once per reveal.
   * Absent for a service with no password at all, such as ClamAV, NATS or
   * Memcached, whose URL is already complete and is shown and copied as it is.
   */
  build?: () => Promise<string>;
}) {
  const [value, setValue] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const descriptionId = useId();

  useEffect(
    () => () => {
      if (timer.current) {
        clearTimeout(timer.current);
      }
    },
    [],
  );

  const markCopied = useCallback(() => {
    setCopied(true);
    if (timer.current) {
      clearTimeout(timer.current);
    }
    timer.current = setTimeout(() => setCopied(false), COPIED_RESET_MS);
  }, []);

  const copy = useCallback(
    async (text: string) => {
      try {
        await navigator.clipboard?.writeText(text);
        markCopied();
      } catch {
        // Clipboard access can be denied; fail quietly rather than surfacing noise.
        setCopied(false);
      }
    },
    [markCopied],
  );

  const revealAndCopy = useCallback(async () => {
    if (!build) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const full = await build();
      setValue(full);
      await copy(full);
    } catch {
      setError(CONNECTION_ERROR);
    } finally {
      setLoading(false);
    }
  }, [build, copy]);

  const shown = value ?? template;

  return (
    <div className="flex flex-col gap-2">
      <div
        id={descriptionId}
        className="min-w-0 overflow-x-auto rounded-md border border-border bg-subtle px-3 py-2"
      >
        <code className="block break-all font-mono text-xs text-ink">{shown}</code>
      </div>
      <p className="sr-only" aria-live="polite">
        {value ? 'Connection string revealed and copied.' : ''}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {!build ? (
          // Nothing to reveal: the string is whole already, so the only useful
          // action is to take it.
          <CopyButton value={template} label="the connection string" />
        ) : value === null ? (
          <button
            type="button"
            onClick={() => void revealAndCopy()}
            disabled={loading}
            aria-busy={loading || undefined}
            aria-describedby={descriptionId}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium text-ink transition-colors duration-fast ease-standard hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Eye width={14} height={14} aria-hidden />
            {loading ? 'Revealing' : 'Reveal and copy connection string'}
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={() => void copy(value)}
              aria-label={copied ? 'Copied connection string' : 'Copy connection string'}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium text-ink transition-colors duration-fast ease-standard hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            >
              {copied ? (
                <Check width={14} height={14} className="text-success" aria-hidden />
              ) : (
                <Copy width={14} height={14} aria-hidden />
              )}
              {copied ? 'Copied' : 'Copy'}
            </button>
            <button
              type="button"
              onClick={() => setValue(null)}
              aria-label="Hide connection string"
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium text-ink-muted transition-colors duration-fast ease-standard hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            >
              <EyeOff width={14} height={14} aria-hidden />
              Hide
            </button>
          </>
        )}
      </div>
      {error ? (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/**
 * One connection string block: a heading, a one-line explanation of when this
 * particular host is the right one, and the string itself: masked until
 * revealed where a password exists, whole and copyable where none does.
 * Shared by the two hosts an endpoint can have, so the two blocks read
 * identically apart from which host and words apply.
 */
function ConnectionStringBlock({
  title,
  description,
  operation,
  endpoint,
  host,
  template,
  secretKey,
}: {
  title: string;
  description: string;
  operation: Operation;
  endpoint: ResolvedEndpoint;
  host: string;
  /** The URL to show for this host: masked where a password exists. */
  template: string;
  /** The key of the secret used to build the string, or null when there is none. */
  secretKey: string | null;
}) {
  const build = secretKey
    ? () =>
        revealOperationSecret(operation.id, secretKey).then((revealed) =>
          buildConnectionUrl(endpoint, host, revealed.value),
        )
    : undefined;

  return (
    <div className="flex flex-col gap-2">
      <Text variant="body-sm" className="font-medium text-ink">
        {title}
      </Text>
      <Text variant="body-sm" tone="secondary">
        {description}
      </Text>
      <ConnectionString template={template} build={build} />
      <ConnectionFields
        endpoint={endpoint}
        host={host}
        url={template}
        operation={operation}
        secretKey={secretKey}
      />
    </div>
  );
}

/**
 * The same endpoint as separate values, each copyable on its own, and the names
 * of the environment variables to put them under.
 *
 * This exists because of a production outage. An application was configured with
 * the whole connection string where it expected a hostname, and crash-looped on
 * "getaddrinfo ENOTFOUND postgresql://user:password@host:5432/database": a URI
 * handed to a name resolver.
 *
 * That was not carelessness. Some applications read one DATABASE_URL and some
 * read DB_HOST and DB_PORT separately, and this card offered exactly one
 * artifact: a whole URI. An Operator wiring the second kind had nothing else to
 * copy. Offering both shapes is what makes the right one available rather than
 * improvised, and it is why they sit together rather than on separate screens.
 *
 * The variable names are here for the same reason one step further on. An
 * Operator filling in a .env file was left to guess what SlideOps would call
 * each value, so a connection made by hand and one made by Connect could
 * disagree on the name of the very variable the application reads. The server
 * states the names it writes, and this shows them.
 */
function ConnectionFields({
  endpoint,
  host,
  url,
  operation,
  secretKey,
}: {
  endpoint: ResolvedEndpoint;
  host: string;
  url: string;
  operation: Operation;
  secretKey: string | null;
}) {
  const fields: { label: string; value: string }[] = [
    { label: 'Host', value: host },
    { label: 'Port', value: String(endpoint.port) },
  ];
  if (endpoint.username) {
    fields.push({ label: 'Username', value: endpoint.username });
  }
  if (endpoint.database) {
    fields.push({ label: 'Database', value: endpoint.database });
  }
  fields.push({ label: 'Connection URL', value: url });

  return (
    <details className="rounded-md border border-border bg-subtle px-3 py-2">
      <summary className="cursor-pointer text-sm text-ink">Or copy the parts separately</summary>
      <Text variant="caption" tone="secondary" className="mt-2 block">
        Use these when your application reads its settings as separate variables, such as{' '}
        <code>DB_HOST</code> and <code>DB_PORT</code>. Putting the whole connection string into a
        host setting is a common mistake and fails with a name lookup error, because the host
        setting expects an address and nothing else.
      </Text>
      <dl className="mt-3 flex flex-col gap-2">
        {fields.map((field) => (
          <div key={field.label} className="flex items-center gap-2">
            <dt className="w-24 shrink-0 text-sm text-ink-muted">{field.label}</dt>
            <dd className="min-w-0 flex-1 truncate font-mono text-sm text-ink">{field.value}</dd>
            <CopyButton value={field.value} label={`the ${field.label.toLowerCase()}`} />
          </div>
        ))}
        {secretKey ? (
          <div className="flex items-center gap-2">
            <dt className="w-24 shrink-0 text-sm text-ink-muted">Password</dt>
            <dd className="min-w-0 flex-1">
              <RevealValue
                label="the password"
                onReveal={() => revealOperationSecret(operation.id, secretKey).then((r) => r.value)}
              />
            </dd>
          </div>
        ) : null}
      </dl>
    </details>
  );
}

/**
 * The names of the environment variables this connection is written under, each
 * copyable on its own.
 *
 * Shown outright rather than behind a disclosure, and once for the endpoint
 * rather than once per address, because the names are the same wherever the
 * service is reached from and because being left to guess them is what sent an
 * Operator back to ask. Only the names: a name is not a secret, and putting a
 * value beside one here would be a second place a password could reach the
 * page. The values are the rows above, and the password stays behind its own
 * reveal.
 */
function EnvironmentVariableNames({ names }: { names: string[] }) {
  if (names.length === 0) {
    return null;
  }
  return (
    <div className="flex flex-col gap-2">
      <Text variant="body-sm" className="font-medium text-ink">
        Environment variable names
      </Text>
      <Text variant="body-sm" tone="secondary">
        Your application reads this connection under these names. SlideOps writes exactly these when
        it connects a Service to this itself, so a connection you wire by hand and one it makes
        agree.
      </Text>
      <ul className="flex flex-col gap-1">
        {names.map((name) => (
          <li key={name} className="flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate font-mono text-sm text-ink">{name}</code>
            <CopyButton value={name} label={`the ${name} variable name`} />
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * The connection section for a Capability that has one.
 *
 * A server login account gets the sign in command and a pointer to the
 * revealable password above, never a "from a container" variant, since nothing
 * containerized ever calls it.
 *
 * Everything else gets up to two connection strings, so which host to use is
 * never something to guess at or come back and ask about: privateHost, the
 * Docker bridge address, is what an app running as a Service on this same Node
 * reaches it at, and is shown first since that is the common case this card
 * exists for; host, the address the server resolved, works only if this Node's
 * firewall has been opened for a remote connection, which is not the default and
 * is called out as such. Either may be absent, since a Node with no saved
 * Discovery has no privateHost yet, and only what is actually known is ever
 * shown.
 *
 * A Capability with no password of any kind still shows all of this. It used to
 * show none of it, because the whole section was gated on there being a secret
 * to reveal, which is how a running ClamAV or NATS ended up with no port and no
 * connection string on the one page meant to state them.
 */
function EndpointConnection({
  operation,
  endpoint,
  secretKey,
}: {
  operation: Operation;
  endpoint: ResolvedEndpoint;
  /** The key of the secret used to build the string, when the Operation has one. */
  secretKey: string | null;
}) {
  const host = endpoint.host;

  if (endpoint.personSignsIn) {
    if (!host) {
      return null;
    }
    return (
      <div className="mt-4 flex flex-col gap-2 border-t border-border pt-4">
        <Text variant="body-sm" className="font-medium text-ink">
          Server login
        </Text>
        <Text variant="body-sm" tone="secondary">
          Sign in with this account, then enter the password revealed above.
        </Text>
        <RevealValue
          value={buildSshSignIn(endpoint, host)}
          label="sign in command"
          sensitive={false}
        />
      </div>
    );
  }

  if (!host && !endpoint.privateHost) {
    return null;
  }

  // The mask the server used inside its own URL, so a template built here for
  // another address reads identically to the one it sent.
  const mask = endpoint.hasPassword ? (endpoint.maskedPassword ?? MASKED_SECRET) : '';

  return (
    <div className="mt-4 flex flex-col gap-4 border-t border-border pt-4">
      {endpoint.privateHost ? (
        <ConnectionStringBlock
          title="Connection string — from a container on this Node"
          description="Use this in a Service's environment. A service installed on this Node is not reachable at its public address by design; this is the address a container reaches it at instead."
          operation={operation}
          endpoint={endpoint}
          host={endpoint.privateHost}
          template={connectionUrlTemplate(endpoint, endpoint.privateHost, mask)}
          secretKey={secretKey}
        />
      ) : null}
      {host ? (
        <ConnectionStringBlock
          title={
            endpoint.privateHost
              ? 'Connection string — from outside this Node'
              : 'Connection string'
          }
          description={
            endpoint.privateHost
              ? "Only reachable if this Node's firewall was explicitly configured to allow a remote connection. Not the default, and not what a Service on this Node should use."
              : secretKey
                ? 'The password stays hidden until you reveal it. Revealing copies the full string.'
                : 'This service has no password of its own, so this is the whole string.'
          }
          operation={operation}
          endpoint={endpoint}
          host={host}
          template={endpoint.url}
          secretKey={secretKey}
        />
      ) : null}
      <EnvironmentVariableNames names={endpoint.variables} />
    </div>
  );
}

/**
 * A generated private key, shown with its own Copy and Download `.pem`
 * actions rather than the single masked line every other secret gets: this
 * is the one secret an Operator is expected to save to a file and use in
 * another SSH client, not paste into a form, so it needs a real download,
 * not just a copy.
 */
function GeneratedPrivateKeyCard({
  operation,
  secretKey,
  filename,
}: {
  operation: Operation;
  secretKey: string;
  filename: string;
}) {
  const [revealed, setRevealed] = useState<string | null>(null);
  const [loading, setLoading] = useState<null | 'copy' | 'download'>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) {
        clearTimeout(timer.current);
      }
    },
    [],
  );

  const resolve = useCallback(async (): Promise<string | null> => {
    if (revealed !== null) {
      return revealed;
    }
    try {
      const result = await revealOperationSecret(operation.id, secretKey);
      setRevealed(result.value);
      return result.value;
    } catch {
      setError('Could not reveal the private key. Try again.');
      return null;
    }
  }, [operation.id, secretKey, revealed]);

  const copy = async () => {
    setLoading('copy');
    setError(null);
    const plaintext = await resolve();
    if (plaintext !== null) {
      try {
        await navigator.clipboard?.writeText(plaintext);
        setCopied(true);
        if (timer.current) {
          clearTimeout(timer.current);
        }
        timer.current = setTimeout(() => setCopied(false), COPIED_RESET_MS);
      } catch {
        setCopied(false);
      }
    }
    setLoading(null);
  };

  const download = async () => {
    setLoading('download');
    setError(null);
    const plaintext = await resolve();
    if (plaintext !== null) {
      const blob = new Blob([plaintext], { type: 'application/x-pem-file' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    }
    setLoading(null);
  };

  return (
    <div className="mt-4 flex flex-col gap-3 border-t border-border pt-4">
      <div className="flex items-center gap-2">
        <KeyRound width={16} height={16} className="text-brand" aria-hidden />
        <Text variant="body-sm" className="font-medium text-ink">
          Your private key
        </Text>
      </div>
      <Text variant="body-sm" tone="secondary">
        Generated for this account and installed on the server. This is the only time it is shown
        here — save it now. It stays revealable through this Operation's own record if you need it
        again, but is never shown anywhere else.
      </Text>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => void copy()}
          disabled={loading !== null}
        >
          {copied ? (
            <Check width={14} height={14} className="text-success" aria-hidden />
          ) : (
            <Copy width={14} height={14} aria-hidden />
          )}
          {loading === 'copy' ? 'Copying' : copied ? 'Copied' : 'Copy private key'}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => void download()}
          disabled={loading !== null}
        >
          <Download width={14} height={14} aria-hidden />
          {loading === 'download' ? 'Preparing' : `Download ${filename}`}
        </Button>
      </div>
      {error ? (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/**
 * The credentials an Operation created, shown so an Operator can turn them into
 * a working connection: the host and the service port, the connection details as
 * plain copyable rows, each secret behind a reveal control that fetches the
 * plaintext lazily, and a ready to copy connection string for a known service.
 * It renders nothing when the Operation carries no such parameters, so a
 * Capability that produced no credentials shows no card.
 *
 * `host` is the address of the Node the Operation ran against. When it is absent
 * the card still shows every parameter, only without a host row or a connection
 * string that would need one.
 */
export function CredentialsCard({
  operation,
  host,
  dockerBridgeAddress,
}: {
  operation: Operation;
  host?: string;
  /** The Node's Docker bridge address, from its most recent Discovery — where
   *  a container on this Node reaches a data store installed on it. Passed
   *  through to resolveEndpoint; see ResolvedEndpoint.privateHost. */
  dockerBridgeAddress?: string;
}) {
  const parameters = operation.parameters ?? {};

  const allSecretKeys = Object.keys(parameters).filter(
    (key) => parameters[key] === SECRET_PLACEHOLDER,
  );
  // A generated private key gets its own dedicated card below, with a real
  // download rather than the single masked line every other secret gets.
  const hasPrivateKey = allSecretKeys.includes('private_key');
  const secretKeys = allSecretKeys.filter((key) => key !== 'private_key');

  // The server resolves the scheme, the host, the port and the variable names
  // from the Capability's own declaration. Nothing about a service is decided
  // here: a table of five engines lived in this component's helper, and every
  // Capability it had never heard of fell past it into the raw parameters below.
  const endpoint = resolveEndpoint(operation.connection, dockerBridgeAddress ?? null);

  const plainRows: PlainRow[] = [];
  if (endpoint) {
    if (endpoint.host) {
      plainRows.push({ key: 'host', label: 'Host', value: endpoint.host });
    }
    if (endpoint.privateHost) {
      plainRows.push({
        key: 'private_host',
        label: 'From a container',
        value: endpoint.privateHost,
      });
    }
    plainRows.push({ key: 'port', label: 'Port', value: String(endpoint.port) });
    if (endpoint.database) {
      plainRows.push({ key: 'database', label: 'Database', value: endpoint.database });
    }
    if (endpoint.username) {
      plainRows.push({ key: 'username', label: 'Username', value: endpoint.username });
    }
  } else {
    // Not a known service: fall back to whatever connection parameters exist, and
    // prepend the Node host when nothing in the parameters already carries one.
    const hasParamHost = CONNECTION_KEYS.some(
      (key) =>
        (key === 'host' || key === 'hostname' || key === 'address') &&
        typeof parameters[key] === 'string' &&
        String(parameters[key]).length > 0,
    );
    if (host && !hasParamHost) {
      plainRows.push({ key: 'host', label: 'Host', value: host });
    }
    for (const key of CONNECTION_KEYS) {
      const value = parameters[key];
      if (value === SECRET_PLACEHOLDER) {
        continue;
      }
      if ((typeof value === 'string' || typeof value === 'number') && String(value).length > 0) {
        plainRows.push({ key, label: labelFor(key), value: String(value) });
      }
    }
  }

  const connectionSecretKey = secretKeys[0] ?? null;
  const showConnection = endpoint !== null && Boolean(endpoint.host || endpoint.privateHost);

  if (secretKeys.length === 0 && plainRows.length === 0 && !showConnection && !hasPrivateKey) {
    return null;
  }

  const username = typeof parameters.username === 'string' ? parameters.username : 'server';

  return (
    <Card>
      <div className="mb-2 flex items-center gap-2">
        <KeyRound width={18} height={18} className="text-brand" aria-hidden />
        <Text variant="h4">Credentials</Text>
      </div>
      <Text variant="body-sm" tone="secondary" className="mb-4">
        The connection details this Capability created. Reveal a secret only when you need it, then
        copy it.
      </Text>
      <dl className="flex flex-col divide-y divide-border">
        {plainRows.map((row) => (
          <CredentialRow key={row.key} label={row.label}>
            <RevealValue value={row.value} label={row.label.toLowerCase()} sensitive={false} />
          </CredentialRow>
        ))}
        {secretKeys.map((key) => (
          <CredentialRow key={key} label={labelFor(key)}>
            <RevealValue
              label={labelFor(key).toLowerCase()}
              sensitive
              onReveal={() =>
                revealOperationSecret(operation.id, key).then((revealed) => revealed.value)
              }
            />
          </CredentialRow>
        ))}
      </dl>
      {hasPrivateKey ? (
        <GeneratedPrivateKeyCard
          operation={operation}
          secretKey="private_key"
          filename={`${username}.pem`}
        />
      ) : null}
      {showConnection && endpoint ? (
        <EndpointConnection
          operation={operation}
          endpoint={endpoint}
          secretKey={connectionSecretKey}
        />
      ) : null}
    </Card>
  );
}
