import {
  listAdminOperations,
  listOperators,
  type OperationStatus,
} from '@slideops/api-client';
import { Text } from '@slideops/design-system';
import { Activity } from '@slideops/icons';
import { Guidance } from '@slideops/tooltips';
import { EmptyState, PageHeader } from '@slideops/ui';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AdminShell } from '../components/AdminShell';
import { StatusBadge } from '../components/Badges';
import { ErrorNote, Loading } from '../components/Feedback';
import { TBody, TD, TH, THead, TR, Table } from '../components/Table';
import { useAsyncData } from '../hooks/useAsyncData';

const STATUS_OPTIONS: OperationStatus[] = [
  'created',
  'discovering',
  'assessing',
  'planning',
  'awaiting_approval',
  'approved',
  'executing',
  'verifying',
  'completed',
  'failed',
  'cancelled',
];

const selectClass =
  'h-9 rounded-md border border-border bg-surface px-3 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus';

/** Operations: the cross-tenant table, filterable by status and Operator. */
export function Operations() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<OperationStatus | ''>('');
  const [operatorId, setOperatorId] = useState<string>('');

  const operators = useAsyncData((signal) => listOperators(signal), []);
  const filter = useMemo(
    () => ({ status: status || undefined, operator_id: operatorId || undefined }),
    [status, operatorId],
  );
  const { state } = useAsyncData(
    (signal) => listAdminOperations(filter, signal),
    [filter],
  );

  return (
    <AdminShell active="operations">
      <PageHeader
        title="Operations"
        description="Every Operation across the platform, newest first. Filter by status or Operator, and open one to read its record. This view never acts on an Operation."
        guidanceKey="operations.record"
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-ink-muted">
          <span>Status</span>
          <select
            className={selectClass}
            value={status}
            onChange={(event) => setStatus(event.target.value as OperationStatus | '')}
            aria-label="Filter by status"
          >
            <option value="">All statuses</option>
            {STATUS_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm text-ink-muted">
          <span>Operator</span>
          <select
            className={selectClass}
            value={operatorId}
            onChange={(event) => setOperatorId(event.target.value)}
            aria-label="Filter by Operator"
          >
            <option value="">All Operators</option>
            {operators.state.status === 'ready'
              ? operators.state.data.map((operator) => (
                  <option key={operator.id} value={operator.id}>
                    {operator.email}
                  </option>
                ))
              : null}
          </select>
        </label>
        <Guidance for="operations.filter" />
      </div>

      {state.status === 'loading' ? <Loading label="Loading Operations" /> : null}
      {state.status === 'error' ? <ErrorNote error={state.error} /> : null}
      {state.status === 'ready' ? (
        state.data.length === 0 ? (
          <EmptyState
            icon={Activity}
            title="No Operations match"
            description="No Operation matches these filters. Clear a filter to widen the view."
          />
        ) : (
          <Table label="Operations">
            <THead>
              <TH>Capability</TH>
              <TH>Operator</TH>
              <TH>Node</TH>
              <TH>Status</TH>
              <TH>Started</TH>
            </THead>
            <TBody>
              {state.data.map((operation) => (
                <TR
                  key={operation.id}
                  interactive
                  onClick={() =>
                    navigate(`/admin/operations/${operation.id}`, { state: { operation } })
                  }
                >
                  <TD className="font-medium">
                    {operation.capability_name ?? operation.capability_key}
                  </TD>
                  <TD className="text-ink-muted">{operation.operator_email}</TD>
                  <TD className="text-ink-muted">{operation.node_name ?? operation.node_id}</TD>
                  <TD>
                    <StatusBadge status={operation.status} />
                  </TD>
                  <TD className="text-ink-muted">
                    {new Date(operation.created_at).toLocaleString()}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )
      ) : null}

      <Text variant="body-sm" tone="secondary" className="mt-4">
        Oversight only. The control plane reads Operations across tenants and never changes them.
      </Text>
    </AdminShell>
  );
}
