import { listOperators } from '@slideops/api-client';
import { EmptyState, PageHeader } from '@slideops/ui';
import { Users } from '@slideops/icons';
import { useNavigate } from 'react-router-dom';
import { AdminShell } from '../components/AdminShell';
import { OperatorStatusBadge } from '../components/Badges';
import { ErrorNote, Loading } from '../components/Feedback';
import { TBody, TD, TH, THead, TR, Table } from '../components/Table';
import { useAsyncData } from '../hooks/useAsyncData';

function when(value: string | null): string {
  return value ? new Date(value).toLocaleString() : 'Never';
}

/** Operators: the cross-tenant roster, each row opening a detail view. */
export function Operators() {
  const navigate = useNavigate();
  const { state } = useAsyncData((signal) => listOperators(signal), []);

  return (
    <AdminShell active="operators">
      <PageHeader
        title="Operators"
        description="Every Operator on the platform, with their Node and Operation counts and when they were last active. Cross-tenant read is for oversight only."
        guidanceKey="operators.roster"
      />

      {state.status === 'loading' ? <Loading label="Loading Operators" /> : null}
      {state.status === 'error' ? <ErrorNote error={state.error} /> : null}
      {state.status === 'ready' ? (
        state.data.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No Operators yet"
            description="When Operators register, they appear here with their status and their activity across the platform."
          />
        ) : (
          <Table label="Operators">
            <THead>
              <TH>Email</TH>
              <TH>Status</TH>
              <TH className="text-right">Nodes</TH>
              <TH className="text-right">Operations</TH>
              <TH>Last active</TH>
            </THead>
            <TBody>
              {state.data.map((operator) => (
                <TR key={operator.id} interactive onClick={() => navigate(`/operators/${operator.id}`)}>
                  <TD className="font-medium">{operator.email}</TD>
                  <TD>
                    <OperatorStatusBadge status={operator.status} />
                  </TD>
                  <TD className="text-right tabular-nums">{operator.node_count}</TD>
                  <TD className="text-right tabular-nums">{operator.operation_count}</TD>
                  <TD className="text-ink-muted">{when(operator.last_active)}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )
      ) : null}
    </AdminShell>
  );
}
