import { listEmailDeliveries, type EmailDelivery } from '@slideops/api-client';
import { Button } from '@slideops/design-system';
import { CheckCircle2, Mail, RotateCcw, XCircle } from '@slideops/icons';
import { EmptyState, PageHeader } from '@slideops/ui';
import { AdminShell } from '../components/AdminShell';
import { ErrorNote, Loading } from '../components/Feedback';
import { TBody, TD, TH, THead, TR, Table } from '../components/Table';
import { useAsyncData } from '../hooks/useAsyncData';

/*
 * A read-only log of every attempted transactional email send: the
 * sending-side mirror of the Webhooks screen. This is where diagnosing "did
 * this receipt/invitation actually go out" starts.
 */

const DELIVERIES_LIMIT = 100;

const providerLabel: Record<string, string> = {
  emailjs: 'EmailJS',
  resend: 'Resend',
  brevo: 'Brevo',
  smtp: 'SMTP',
};

function when(value: string): string {
  return new Date(value).toLocaleString();
}

function OutcomeCell({ outcome }: { outcome: string }) {
  if (outcome === 'sent') {
    return (
      <span className="inline-flex items-center gap-1.5 font-medium text-success">
        <CheckCircle2 width={14} height={14} aria-hidden />
        Sent
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 font-medium text-danger">
      <XCircle width={14} height={14} aria-hidden />
      Failed
    </span>
  );
}

export function EmailDeliveries() {
  const { state, reload } = useAsyncData((signal) => listEmailDeliveries(DELIVERIES_LIMIT, signal), []);

  const deliveries: EmailDelivery[] = state.status === 'ready' ? state.data : [];

  return (
    <AdminShell active="email-deliveries">
      <PageHeader
        title="Email deliveries"
        description="The most recent transactional email send attempts, newest first. Read only: use this to see whether a receipt, invitation, or other message actually went out."
        actions={
          <Button variant="secondary" size="sm" onClick={reload}>
            <RotateCcw width={14} height={14} aria-hidden />
            Reload
          </Button>
        }
      />

      {state.status === 'loading' ? <Loading label="Loading email deliveries" /> : null}
      {state.status === 'error' ? <ErrorNote error={state.error} /> : null}

      {state.status === 'ready' ? (
        deliveries.length === 0 ? (
          <EmptyState
            icon={Mail}
            title="No email deliveries yet"
            description="Every transactional email SlideOps sends will be recorded here as it is attempted."
          />
        ) : (
          <Table label="Email deliveries">
            <THead>
              <TH>Sent</TH>
              <TH>To</TH>
              <TH>Subject</TH>
              <TH>Provider</TH>
              <TH>Outcome</TH>
              <TH>Detail</TH>
            </THead>
            <TBody>
              {deliveries.map((delivery) => (
                <TR key={delivery.id}>
                  <TD className="text-ink-muted">{when(delivery.sent_at)}</TD>
                  <TD className="font-mono text-xs">{delivery.to}</TD>
                  <TD>{delivery.subject || 'Not set'}</TD>
                  <TD className="font-medium">{providerLabel[delivery.provider] ?? delivery.provider}</TD>
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
