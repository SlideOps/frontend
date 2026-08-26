import {
  adoptWorkload,
  ApiError,
  listNodeWorkloads,
  type Workload,
} from '@slideops/api-client';
import { Button, Text } from '@slideops/design-system';
import { ArrowRight, RefreshCw } from '@slideops/icons';
import { DataGrid, SearchBar, Toolbar, type DataGridColumn, type DataGridRow } from '@slideops/ui';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ServiceStatusBadge } from './Badges';
import { ErrorNote, Loading } from './Feedback';

/*
 * The container runtime's own Capability page should not be the one place on
 * this platform where "what is actually running here" is invisible. Before
 * this, seeing what Docker was running on a Node meant leaving the Capability
 * page entirely for the separate cross-server Import screen. This is the
 * same read (listNodeWorkloads) and the same one-click Adopt
 * (adoptWorkload) that screen already offers, narrowed to containers and
 * shown where an Operator looking at "Enable containers" would think to look
 * for it.
 *
 * An adopted container's logs, shell, environment, and resource meters
 * already live on its Service page in full; this does not duplicate them; it
 * is the list that gets an Operator there, and the one click that makes a
 * container reachable from it in the first place.
 */

interface ContainerManagerProps {
  nodeId: string;
  /** Where an adopted container is filed. Required to adopt; browsing needs neither. */
  projectId?: string;
}

export function ContainerManager({ nodeId, projectId }: ContainerManagerProps) {
  const navigate = useNavigate();
  const [workloads, setWorkloads] = useState<Workload[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);
  const [search, setSearch] = useState('');
  const [busyRef, setBusyRef] = useState('');
  const [adoptError, setAdoptError] = useState<ApiError | null>(null);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError(null);
      try {
        const result = await listNodeWorkloads(nodeId, signal);
        if (!signal?.aborted) {
          setWorkloads(result);
        }
      } catch (caught) {
        if (!signal?.aborted) {
          setError(caught instanceof ApiError ? caught : new ApiError(0, 'unknown_error', 'This did not load.'));
        }
      } finally {
        if (!signal?.aborted) {
          setLoading(false);
        }
      }
    },
    [nodeId],
  );

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  async function adopt(workload: Workload) {
    if (!projectId) {
      setAdoptError(new ApiError(0, 'no_project', 'Pick a Project on this page first, so the container has somewhere to be filed.'));
      return;
    }
    setBusyRef(workload.ref);
    setAdoptError(null);
    try {
      await adoptWorkload(nodeId, { project_id: projectId, ref: workload.ref, runtime: workload.runtime });
      await load();
    } catch (caught) {
      setAdoptError(caught instanceof ApiError ? caught : new ApiError(0, 'unknown_error', 'That container could not be adopted.'));
    } finally {
      setBusyRef('');
    }
  }

  if (loading) {
    return <Loading label="Reading what this Node is running" />;
  }
  if (error) {
    return <ErrorNote error={error} />;
  }

  const containers = (workloads ?? []).filter((workload) => workload.runtime === 'container');
  const term = search.trim().toLowerCase();
  const filtered = term
    ? containers.filter(
        (workload) =>
          workload.name.toLowerCase().includes(term) || (workload.image ?? '').toLowerCase().includes(term),
      )
    : containers;

  const columns: DataGridColumn[] = [
    { key: 'name', header: 'Name', sortable: true },
    { key: 'image', header: 'Image', sortable: true },
    { key: 'status', header: 'Status' },
    { key: 'ports', header: 'Ports' },
    { key: 'action', header: '', align: 'end' },
  ];

  const rows: DataGridRow[] = filtered.map((workload) => ({
    id: workload.ref,
    sortValues: { name: workload.name, image: workload.image ?? '' },
    onClick: workload.adopted && workload.service_id ? () => navigate(`/app/services/${workload.service_id}`) : undefined,
    cells: {
      name: workload.name,
      image: workload.image || '—',
      status: <ServiceStatusBadge status={workload.status} />,
      ports: workload.ports.map((port) => port.host).join(', ') || '—',
      action: workload.adopted ? (
        <Button size="sm" variant="ghost" onClick={() => workload.service_id && navigate(`/app/services/${workload.service_id}`)}>
          Manage
          <ArrowRight width={14} height={14} aria-hidden />
        </Button>
      ) : (
        <Button size="sm" variant="secondary" disabled={busyRef === workload.ref} onClick={() => void adopt(workload)}>
          {busyRef === workload.ref ? 'Adopting' : 'Adopt'}
        </Button>
      ),
    },
  }));

  return (
    <div className="flex flex-col gap-3">
      <Toolbar
        actions={
          <Button size="sm" variant="ghost" onClick={() => void load()}>
            <RefreshCw width={15} height={15} aria-hidden />
            Refresh
          </Button>
        }
      >
        <SearchBar value={search} onChange={setSearch} label="Search containers" placeholder="Search by name or image..." />
      </Toolbar>
      {adoptError ? <ErrorNote error={adoptError} /> : null}
      <DataGrid
        columns={columns}
        rows={rows}
        emptyMessage={
          containers.length === 0
            ? 'No containers are running on this Node yet.'
            : 'Nothing matches that search.'
        }
      />
      <Text variant="caption" tone="secondary">
        An adopted container's logs, shell, environment, and resource use live on its own Service page. Adopting
        does not touch the container: it keeps running exactly as it was.
      </Text>
    </div>
  );
}
