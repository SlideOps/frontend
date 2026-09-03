import {
  ApiError,
  lookupLoginRateLimit,
  resetLoginRateLimit,
  type RateLimitEntry,
} from '@slideops/api-client';
import { Button, Field, Text } from '@slideops/design-system';
import { Search, ShieldAlert, Unlock } from '@slideops/icons';
import { EmptyState, PageHeader } from '@slideops/ui';
import { useState } from 'react';
import { AdminShell } from '../components/AdminShell';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { TBody, TD, TH, THead, TR, Table } from '../components/Table';

/*
 * Login rate limit lookup and reset. The support scenario is an Operator
 * locked out by too many login attempts: this looks up every active counter
 * for their email (the limiter keys on email plus the caller's IP, so more
 * than one IP can be contributing to a lockout) and clears them all at once.
 */

function minutesAndSeconds(totalSeconds: number): string {
  if (totalSeconds <= 0) {
    return 'expiring now';
  }
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) {
    return `${seconds}s`;
  }
  return `${minutes}m ${seconds}s`;
}

export function RateLimits() {
  const [email, setEmail] = useState('');
  const [searched, setSearched] = useState<string | null>(null);
  const [entries, setEntries] = useState<RateLimitEntry[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingClear, setConfirmingClear] = useState(false);

  const runLookup = async () => {
    const trimmed = email.trim();
    if (!trimmed) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await lookupLoginRateLimit(trimmed);
      setEntries(result);
      setSearched(trimmed);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'That lookup did not go through. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const runClear = async () => {
    if (!searched) {
      return;
    }
    setError(null);
    try {
      await resetLoginRateLimit(searched);
      setEntries([]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'That reset did not go through. Try again.');
    } finally {
      setConfirmingClear(false);
    }
  };

  return (
    <AdminShell active="rate-limits">
      <PageHeader
        title="Login rate limits"
        description="Look up an Operator's active login attempt counters by email, and clear them across every IP if they are locked out before the window rolls over on its own."
      />

      <div className="mb-6 flex items-end gap-3">
        <div className="w-full max-w-sm">
          <Field
            label="Operator email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="operator@slideops.com"
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                runLookup();
              }
            }}
          />
        </div>
        <Button variant="primary" onClick={runLookup} disabled={loading || email.trim() === ''}>
          <Search width={15} height={15} aria-hidden />
          {loading ? 'Looking up' : 'Look up'}
        </Button>
      </div>

      {error ? (
        <p role="alert" className="mb-4 text-sm text-danger">
          {error}
        </p>
      ) : null}

      {searched && entries ? (
        entries.length === 0 ? (
          <EmptyState
            icon={Unlock}
            title={`${searched} is not rate limited`}
            description="No active login attempt counters found for this email. They are free to sign in."
          />
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-3">
              <Text variant="body-sm" tone="secondary">
                {entries.length} active counter{entries.length === 1 ? '' : 's'} for {searched}
              </Text>
              <Button variant="danger" size="sm" onClick={() => setConfirmingClear(true)}>
                <Unlock width={14} height={14} aria-hidden />
                Clear rate limit
              </Button>
            </div>
            <Table label="Active login rate limit counters">
              <THead>
                <TH>From</TH>
                <TH>Attempts</TH>
                <TH>Resets in</TH>
              </THead>
              <TBody>
                {entries.map((entry) => {
                  const [, ip] = entry.subject.split('|');
                  const overMax = entry.attempts >= entry.max;
                  return (
                    <TR key={entry.subject}>
                      <TD className="font-mono text-xs">{ip || entry.subject}</TD>
                      <TD>
                        <span className={overMax ? 'font-medium text-danger' : ''}>
                          {entry.attempts} / {entry.max}
                        </span>
                      </TD>
                      <TD className="text-ink-muted">{minutesAndSeconds(entry.resets_in_seconds)}</TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          </div>
        )
      ) : null}

      {!searched ? (
        <EmptyState
          icon={ShieldAlert}
          title="Search for an Operator's email"
          description="Enter the email an Operator is trying to sign in with to see whether they are currently rate limited, and clear it if they are."
        />
      ) : null}

      <ConfirmDialog
        open={confirmingClear}
        title="Clear this login rate limit?"
        description={
          <>
            Removes every active login attempt counter for{' '}
            <strong className="text-ink">{searched}</strong> across every IP that has attempted it,
            immediately lifting the lockout rather than waiting for the window to roll over on its
            own.
          </>
        }
        confirmLabel="Clear rate limit"
        confirmVariant="danger"
        onConfirm={runClear}
        onCancel={() => setConfirmingClear(false)}
      />
    </AdminShell>
  );
}
