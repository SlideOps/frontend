import { revealOperationSecret, type Operation } from '@slideops/api-client';
import { Card, Text } from '@slideops/design-system';
import { KeyRound } from '@slideops/icons';
import type { ReactNode } from 'react';
import { RevealValue } from './RevealValue';

/**
 * The literal a secret parameter carries in an Operation's `parameters`. A
 * parameter is secret, and revealable, exactly when its value is this string;
 * the plaintext lives only behind the reveal endpoint, never in the record.
 */
const SECRET_PLACEHOLDER = '[stored securely]';

/**
 * The non-secret parameters that read as connection details, in the order an
 * Operator scans them. Only those actually present on an Operation are shown.
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

interface ConnectionRow {
  key: string;
  value: string;
}

/** One labelled row in the credentials list. */
function CredentialRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[8rem_1fr] items-center gap-3 py-3 first:pt-0 last:pb-0">
      <dt className="text-xs font-medium text-ink-muted">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}

/**
 * The credentials an Operation created, shown so an Operator can read, reveal,
 * and copy them: the connection details as plain copyable rows, and each secret
 * parameter behind a reveal control that fetches the plaintext lazily and only
 * when asked. It renders nothing when the Operation carries no such parameters,
 * so a Capability that produced no credentials shows no card.
 */
export function CredentialsCard({ operation }: { operation: Operation }) {
  const parameters = operation.parameters ?? {};

  const secretKeys = Object.keys(parameters).filter(
    (key) => parameters[key] === SECRET_PLACEHOLDER,
  );

  const connectionRows: ConnectionRow[] = [];
  for (const key of CONNECTION_KEYS) {
    const value = parameters[key];
    if (value === SECRET_PLACEHOLDER) {
      continue;
    }
    if ((typeof value === 'string' || typeof value === 'number') && String(value).length > 0) {
      connectionRows.push({ key, value: String(value) });
    }
  }

  if (secretKeys.length === 0 && connectionRows.length === 0) {
    return null;
  }

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
        {connectionRows.map((row) => (
          <CredentialRow key={row.key} label={labelFor(row.key)}>
            <RevealValue value={row.value} label={labelFor(row.key).toLowerCase()} sensitive={false} />
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
    </Card>
  );
}
