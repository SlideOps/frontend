import type { Domain } from '@slideops/api-client';
import { Text } from '@slideops/design-system';
import { ChevronRight } from '@slideops/icons';
import { Link } from 'react-router-dom';
import type { StatusReading, StatusTone } from '../domain-status';
import { CopyButton } from './CopyButton';

/*
 * The small pieces every domain surface repeats: how a reading is coloured, how
 * a record is offered for copying, and how expected is shown beside found.
 *
 * They live together because the honesty rule is the same in all three. A
 * reading always carries the evidence it was derived from, and a comparison
 * always shows both sides, so nothing on screen asks to be taken on trust.
 */

const TONE_CLASS: Record<StatusTone, string> = {
  ok: 'text-success',
  warn: 'text-warning',
  bad: 'text-danger',
  muted: 'text-ink-muted',
};

/** One reading, with what it was based on underneath. */
export function StatusPill({ reading, label }: { reading: StatusReading; label: string }) {
  return (
    <div className="min-w-0">
      <Text variant="caption" tone="secondary" className="block">
        {label}
      </Text>
      <span className={`text-sm font-medium ${TONE_CLASS[reading.tone]}`}>{reading.label}</span>
      {reading.detail ? (
        <Text variant="caption" tone="secondary" className="mt-0.5 block">
          {reading.detail}
        </Text>
      ) : null}
    </div>
  );
}

/**
 * What was expected, beside what was actually found.
 *
 * Never one without the other. "Wrong" tells an Operator nothing they can act
 * on; "expected this address, found that one" tells them which record to edit.
 */
export function ExpectedFound({
  expected,
  found,
  expectedLabel = 'Expected',
  foundLabel = 'Found',
}: {
  expected: string;
  found: string;
  expectedLabel?: string;
  foundLabel?: string;
}) {
  return (
    <dl className="flex flex-col gap-1">
      <div className="flex flex-wrap items-baseline gap-x-3">
        <dt className="w-20 shrink-0 text-sm text-ink-muted">{expectedLabel}</dt>
        <dd className="min-w-0 flex-1 break-words font-mono text-sm text-ink">{expected}</dd>
      </div>
      <div className="flex flex-wrap items-baseline gap-x-3">
        <dt className="w-20 shrink-0 text-sm text-ink-muted">{foundLabel}</dt>
        <dd className="min-w-0 flex-1 break-words font-mono text-sm text-ink">{found}</dd>
      </div>
    </dl>
  );
}

/**
 * The record to create at a registrar, one copyable field at a time.
 *
 * A registrar's form is three or four separate boxes, so the record is offered
 * the same way. Handing over one line of prose is what makes somebody paste a
 * whole hostname into a field that wanted a label.
 */
export function DomainRecordFields({ domain }: { domain: Domain }) {
  const fields = [
    { label: 'Type', value: domain.record.type },
    { label: 'Name', value: domain.record.name },
    { label: 'Value', value: domain.record.value },
    { label: 'TTL', value: domain.record.ttl },
  ];
  return (
    <dl className="flex flex-col gap-1">
      {fields.map((field) => (
        <div key={field.label} className="flex items-center gap-2">
          <dt className="w-16 shrink-0 text-sm text-ink-muted">{field.label}</dt>
          <dd className="min-w-0 flex-1 truncate font-mono text-sm text-ink">{field.value}</dd>
          <CopyButton value={field.value} label={`the ${field.label.toLowerCase()}`} />
        </div>
      ))}
    </dl>
  );
}

/**
 * The way into the one place domains are managed.
 *
 * A Service and a Node both still show the domain state that belongs to them,
 * because losing sight of a Service's own addresses from the Service would be a
 * worse page, not a tidier one. What they no longer carry is a second copy of
 * the flow that changes it: two places to change the same thing is how the
 * states got out of step to begin with.
 */
export function ManageDomainsLink({ label, to }: { label: string; to: string }) {
  return (
    <Link
      to={to}
      className="inline-flex items-center gap-1 rounded-md text-sm text-brand underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
    >
      {label}
      <ChevronRight width={15} height={15} aria-hidden />
    </Link>
  );
}
