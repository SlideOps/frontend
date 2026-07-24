import { listAdminOperations, type AdminOperation } from '@slideops/api-client';
import { Button, Card, Text } from '@slideops/design-system';
import { ArrowLeft } from '@slideops/icons';
import { Guidance } from '@slideops/tooltips';
import { PageHeader } from '@slideops/ui';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { AdminShell } from '../components/AdminShell';
import { StatusBadge } from '../components/Badges';
import { ErrorNote, Loading } from '../components/Feedback';
import { useAsyncData } from '../hooks/useAsyncData';

function RecordRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[10rem_1fr] gap-3 py-2.5">
      <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">{label}</dt>
      <dd className="min-w-0 break-words text-sm text-ink">{value}</dd>
    </div>
  );
}

/**
 * A read-only Operation record for the control plane. It prefers the row handed
 * over from the Operations table, and falls back to reading the cross-tenant
 * list and finding this Operation so a deep link still resolves. It never offers
 * an action: the Admin surface observes, it does not act on an Operation.
 */
export function AdminOperationDetail() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const fromState = (location.state as { operation?: AdminOperation } | null)?.operation;

  const { state } = useAsyncData(
    async (signal): Promise<AdminOperation | null> => {
      if (fromState && fromState.id === id) {
        return fromState;
      }
      const all = await listAdminOperations({}, signal);
      return all.find((operation) => operation.id === id) ?? null;
    },
    [id],
  );

  return (
    <AdminShell active="operations">
      <Button variant="ghost" size="sm" className="mb-4" onClick={() => navigate('/admin/operations')}>
        <ArrowLeft width={16} height={16} aria-hidden />
        All Operations
      </Button>

      {state.status === 'loading' ? <Loading label="Loading this Operation" /> : null}
      {state.status === 'error' ? <ErrorNote error={state.error} /> : null}
      {state.status === 'ready' && state.data === null ? (
        <Card>
          <Text variant="body-sm" tone="secondary">
            This Operation is no longer in the cross-tenant view.
          </Text>
        </Card>
      ) : null}
      {state.status === 'ready' && state.data ? (
        <>
          <PageHeader
            title={state.data.capability_name ?? state.data.capability_key}
            description="A read-only record, read across tenants for oversight."
            actions={<StatusBadge status={state.data.status} />}
          />
          <Card>
            <div className="mb-2 flex items-center gap-2">
              <Text variant="h4">Record</Text>
              <Guidance for="operations.record" />
            </div>
            <dl className="divide-y divide-border">
              <RecordRow label="Operation" value={state.data.id} />
              <RecordRow label="Capability" value={state.data.capability_key} />
              <RecordRow label="Operator" value={state.data.operator_email} />
              <RecordRow label="Node" value={state.data.node_name ?? state.data.node_id} />
              <RecordRow label="Status" value={state.data.status.replace(/_/g, ' ')} />
              <RecordRow label="Created" value={new Date(state.data.created_at).toLocaleString()} />
            </dl>
          </Card>
        </>
      ) : null}
    </AdminShell>
  );
}
