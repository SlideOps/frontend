import { listWebhookDeliveries, type WebhookDelivery } from '@slideops/api-client';
import { Button } from '@slideops/design-system';
import { AlertTriangle, CheckCircle2, Clock, RotateCcw, Waypoints, XCircle } from '@slideops/icons';
import { EmptyState, PageHeader } from '@slideops/ui';
import { AdminShell } from '../components/AdminShell';
import { ErrorNote, Loading } from '../components/Feedback';
import { TBody, TD, TH, THead, TR, Table } from '../components/Table';
import { useAsyncData } from '../hooks/useAsyncData';

/*
 * A read-only log of every inbound payment provider webhook (Paystack,
 * Flutterwave): whether it arrived at all, whether its signature checked
 * out, and what it did. This is where diagnosing a payment stuck pending
 * starts -- did its webhook ever reach us, and what happened when it did --
 * before reaching for Verify or Recover on the subscriber's own page.
 */

const DELIVERIES_LIMIT = 100;

const providerLabel: Record<string, string> = {
  paystack: 'Paystack',
  flutterwave: 'Flutterwave',
};

const outcomeMeta: Record<string, { label: string; tone: string; icon: typeof CheckCircle2 }> = {
  accepted_success: { label: 'Accepted, payment succeeded', tone: 'text-success', icon: CheckCircle2 },
  accepted_failed: { label: 'Accepted, payment failed', tone: 'text-danger', icon: XCircle },
  accepted_pending: { label: 'Accepted, still pending', tone: 'text-ink-muted', icon: Clock },
  invalid_signature: { label: 'Invalid signature', tone: 'text-danger', icon: AlertTriangle },
  unknown_reference: { label: 'Unknown reference', tone: 'text-warning', icon: AlertTriangle },
  error: { label: 'Error', tone: 'text-danger', icon: AlertTriangle },
};

function when(value: string): string {
  return new Date(value).toLocaleString();
}

function OutcomeCell({ outcome }: { outcome: string }) {
  const meta = outcomeMeta[outcome];
  if (!meta) {
    return <span className="text-ink-muted">{outcome}</span>;
  }
  const Icon = meta.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 font-medium ${meta.tone}`}>
      <Icon width={14} height={14} aria-hidden />
      {meta.label}
    </span>
  );
}

export function WebhookDeliveries() {
  const { state, reload } = useAsyncData(
    (signal) => listWebhookDeliveries(DELIVERIES_LIMIT, signal),
    [],
  );

  const deliveries: WebhookDelivery[] = state.status === 'ready' ? state.data : [];

  return (
    <AdminShell active="webhooks">
      <PageHeader
        title="Webhook deliveries"
        description="The most recent Paystack and Flutterwave webhook deliveries, newest first. Read only: use this to see whether a provider's webhook ever arrived before reaching for Verify or Recover on a subscriber's page."
        actions={
          <Button variant="secondary" size="sm" onClick={reload}>
            <RotateCcw width={14} height={14} aria-hidden />
            Reload
          </Button>
        }
      />

      {state.status === 'loading' ? <Loading label="Loading webhook deliveries" /> : null}
      {state.status === 'error' ? <ErrorNote error={state.error} /> : null}

      {state.status === 'ready' ? (
        deliveries.length === 0 ? (
          <EmptyState
            icon={Waypoints}
            title="No webhook deliveries yet"
            description="Every inbound Paystack and Flutterwave payment webhook will be recorded here as it arrives."
          />
        ) : (
          <Table label="Webhook deliveries">
            <THead>
              <TH>Received</TH>
              <TH>Provider</TH>
              <TH>Reference</TH>
              <TH>Outcome</TH>
              <TH>Detail</TH>
            </THead>
            <TBody>
              {deliveries.map((delivery) => (
                <TR key={delivery.id}>
                  <TD className="text-ink-muted">{when(delivery.received_at)}</TD>
                  <TD className="font-medium">{providerLabel[delivery.provider] ?? delivery.provider}</TD>
                  <TD className="font-mono text-xs text-ink-muted">{delivery.reference || '—'}</TD>
                  <TD>
                    <OutcomeCell outcome={delivery.outcome} />
                  </TD>
                  <TD className="max-w-sm text-ink-muted">{delivery.detail || ''}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )
      ) : null}
    </AdminShell>
  );
}
