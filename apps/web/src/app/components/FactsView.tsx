import type { Facts } from '@slideops/api-client';
import { Text } from '@slideops/design-system';

/*
 * A readable view of the Facts that Discovery gathered. The backend serializes a
 * typed struct to jsonb, so this renders the shape it receives: scalars inline,
 * lists as chips, and nested objects as their own small groups. It stays open to
 * extra keys so a new Fact shows up without a code change.
 */

export function humanize(key: string): string {
  const spaced = key.replace(/_/g, ' ').trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function Scalar({ value }: { value: string | number | boolean }) {
  return (
    <Text variant="code" className="break-words text-ink">
      {String(value)}
    </Text>
  );
}

function Chips({ items }: { items: Array<string | number | boolean> }) {
  if (items.length === 0) {
    return (
      <Text variant="body-sm" tone="secondary">
        None
      </Text>
    );
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item, index) => (
        <span
          key={`${String(item)}-${index}`}
          className="inline-flex rounded-md bg-subtle px-2 py-0.5 font-mono text-xs text-ink-muted"
        >
          {String(item)}
        </span>
      ))}
    </div>
  );
}

function isScalar(value: unknown): value is string | number | boolean {
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
}

export function FactValue({ value }: { value: unknown }) {
  if (value === null || value === undefined) {
    return (
      <Text variant="body-sm" tone="secondary">
        Not reported
      </Text>
    );
  }
  if (isScalar(value)) {
    return <Scalar value={value} />;
  }
  if (Array.isArray(value)) {
    if (value.every(isScalar)) {
      return <Chips items={value} />;
    }
    return (
      <div className="flex flex-col gap-2">
        {value.map((item, index) => (
          <FactValue key={index} value={item} />
        ))}
      </div>
    );
  }
  if (typeof value === 'object') {
    return (
      <dl className="flex flex-col gap-2">
        {Object.entries(value as Record<string, unknown>).map(([key, nested]) => (
          <div key={key} className="grid gap-1 sm:grid-cols-[10rem_1fr] sm:gap-3">
            <dt className="text-xs font-medium text-ink-muted">{humanize(key)}</dt>
            <dd className="min-w-0">
              <FactValue value={nested} />
            </dd>
          </div>
        ))}
      </dl>
    );
  }
  return null;
}

export function FactsView({ facts }: { facts: Facts }) {
  const entries = Object.entries(facts).filter(([, value]) => value !== undefined);

  if (entries.length === 0) {
    return (
      <Text variant="body-sm" tone="secondary">
        Discovery returned no Facts for this Node.
      </Text>
    );
  }

  return (
    <div className="flex flex-col divide-y divide-border">
      {entries.map(([key, value]) => (
        <div
          key={key}
          className="grid grid-cols-1 gap-2 py-3 first:pt-0 last:pb-0 sm:grid-cols-[12rem_1fr] sm:gap-4"
        >
          <Text variant="body-sm" className="font-medium">
            {humanize(key)}
          </Text>
          <div className="min-w-0">
            <FactValue value={value} />
          </div>
        </div>
      ))}
    </div>
  );
}
