import type { Capability, CeleryCheck, Operation } from '@slideops/api-client';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes, MemoryRouter, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderInApp } from '../../test/render';

/*
 * Configuring, discovering, and inspecting a Celery worker from a Service's
 * own Capability page.
 *
 * What is worth pinning: a discovered candidate only fills the form, never
 * submits anything on its own; preflight renders the real evidence behind
 * each check rather than a bare pass/fail; the actual write goes through the
 * same createOperation every other Capability uses, so it lands on the same
 * plan-review page; and once a worker is configured, its own lifecycle
 * actions are links to their own Capability pages, not a second submit path.
 */

const discoverCelery = vi.fn();
const preflightCelery = vi.fn();
const createOperation = vi.fn();
const runCapabilityAction = vi.fn();
const sendCeleryTestTask = vi.fn();

vi.mock('@slideops/api-client', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  discoverCelery: (...args: unknown[]) => discoverCelery(...args),
  preflightCelery: (...args: unknown[]) => preflightCelery(...args),
  createOperation: (...args: unknown[]) => createOperation(...args),
  runCapabilityAction: (...args: unknown[]) => runCapabilityAction(...args),
  sendCeleryTestTask: (...args: unknown[]) => sendCeleryTestTask(...args),
}));

const { CeleryManager, isCeleryCapability, latestConfiguredWorker, stringParam } = await import(
  './CeleryManager'
);

const CONFIGURE_CAPABILITY: Capability = {
  key: 'configure-celery-worker',
  name: 'Configure Celery worker',
  category: 'Messaging',
  description: 'Turn a configured application into a supervised Celery worker.',
  risk_level: 'medium',
  parameters: [
    { key: 'working_directory', label: 'Working directory', type: 'path', required: true, help: '' },
    { key: 'python_executable', label: 'Python executable', type: 'string', required: true, help: '' },
    { key: 'celery_app', label: 'Celery application', type: 'string', required: true, help: '' },
    { key: 'broker_url', label: 'Broker URL', type: 'string', required: true, help: '' },
    { key: 'result_backend', label: 'Result backend', type: 'string', required: false, help: '' },
    { key: 'worker_name', label: 'Worker name', type: 'string', required: false, help: '' },
    { key: 'queues', label: 'Queues', type: 'string', required: false, help: '' },
    { key: 'concurrency', label: 'Concurrency', type: 'number', required: false, help: '' },
    {
      key: 'log_level',
      label: 'Log level',
      type: 'choice',
      required: false,
      help: '',
      options: ['INFO', 'WARNING', 'ERROR', 'DEBUG'],
    },
    {
      key: 'pool',
      label: 'Pool',
      type: 'choice',
      required: false,
      help: '',
      options: ['prefork', 'solo', 'threads', 'eventlet'],
    },
    { key: 'run_as_user', label: 'Run as user', type: 'string', required: false, help: '' },
    { key: 'extra_args', label: 'Additional arguments', type: 'text', required: false, help: '' },
  ],
};

/** Renders the in-memory route's own search string, not jsdom's document
 * location, which MemoryRouter never touches. */
function CapabilityPageMarker() {
  const location = useLocation();
  return <div>Capability page: {location.search}</div>;
}

function show(overrides: Partial<Parameters<typeof CeleryManager>[0]> = {}) {
  return renderInApp(
    <MemoryRouter initialEntries={['/app/capabilities/configure-celery-worker']}>
      <Routes>
        <Route
          path="/app/capabilities/configure-celery-worker"
          element={
            <CeleryManager
              capability={CONFIGURE_CAPABILITY}
              nodeId="node-1"
              serviceId="service-1"
              operations={[]}
              operationsLoading={false}
              operationsError={null}
              onReload={() => {}}
              {...overrides}
            />
          }
        />
        <Route path="/app/operations/:id" element={<div>Operation detail page</div>} />
        <Route path="/app/capabilities/:key" element={<CapabilityPageMarker />} />
      </Routes>
    </MemoryRouter>,
  );
}

function configuredOperation(overrides: Partial<Operation> = {}): Operation {
  return {
    id: 'op-1',
    node_id: 'node-1',
    capability_key: 'configure-celery-worker',
    status: 'completed',
    plan: null,
    verification: null,
    error: null,
    created_at: '2026-01-01T00:00:00Z',
    completed_at: '2026-01-01T00:05:00Z',
    approved_at: '2026-01-01T00:01:00Z',
    started_at: '2026-01-01T00:02:00Z',
    parameters: {
      working_directory: '/opt/docai/backend',
      python_executable: '/opt/docai/backend/.venv/bin/python',
      celery_app: 'app.celery:celery_app',
      broker_url: 'redis://localhost:6379/0',
    },
    ...overrides,
  };
}

beforeEach(() => {
  // The task tables (Active/Reserved/Registered) always mount once a worker
  // is configured; only the tests about those tables care what they show.
  runCapabilityAction.mockResolvedValue({ columns: [], rows: [] });
});

describe('isCeleryCapability', () => {
  it('recognizes only configure-celery-worker', () => {
    expect(isCeleryCapability('configure-celery-worker')).toBe(true);
    expect(isCeleryCapability('inspect-celery-worker')).toBe(false);
    expect(isCeleryCapability('install-redis')).toBe(false);
  });
});

describe('latestConfiguredWorker and stringParam', () => {
  it('picks the newest completed configure-celery-worker Operation', () => {
    const older = configuredOperation({ id: 'op-old', completed_at: '2025-01-01T00:00:00Z' });
    const newer = configuredOperation({ id: 'op-new', completed_at: '2026-06-01T00:00:00Z' });
    const other = configuredOperation({ id: 'op-other', capability_key: 'start-celery-worker' });

    expect(latestConfiguredWorker([older, newer, other])?.id).toBe('op-new');
    expect(latestConfiguredWorker([other])).toBeNull();
    expect(latestConfiguredWorker([])).toBeNull();
  });

  it('reads a string parameter, or an empty string when absent', () => {
    const op = configuredOperation();
    expect(stringParam(op, 'working_directory')).toBe('/opt/docai/backend');
    expect(stringParam(op, 'does_not_exist')).toBe('');
  });
});

describe('CeleryManager: not yet configured', () => {
  it('shows a loading state while Operations are still loading', () => {
    show({ operationsLoading: true });
    expect(screen.getByText('Reading this Node\'s Celery configuration')).toBeInTheDocument();
  });

  it('shows the discovery panel and, once a candidate is picked, fills the form', async () => {
    const operator = userEvent.setup();
    discoverCelery.mockResolvedValue({
      candidates: [{ target: 'app.celery:celery_app', file: 'app/celery.py' }],
      python_candidates: ['/opt/docai/backend/.venv/bin/python'],
      has_pyproject_toml: true,
      has_requirements_txt: false,
      has_pipfile: false,
      has_poetry_lock: false,
      has_uv_lock: false,
    });
    show();

    await operator.type(
      screen.getByLabelText('Application directory to scan'),
      '/opt/docai/backend',
    );
    await operator.click(screen.getByRole('button', { name: 'Scan' }));

    expect(discoverCelery).toHaveBeenCalledWith('service-1', '/opt/docai/backend');
    const candidateButton = await screen.findByText('app.celery:celery_app');
    await operator.click(candidateButton);

    expect(screen.getByLabelText('Working directory')).toHaveValue('/opt/docai/backend');
    expect(screen.getByLabelText('Celery application')).toHaveValue('app.celery:celery_app');
  });

  it('never submits anything on its own when a candidate is picked', async () => {
    const operator = userEvent.setup();
    discoverCelery.mockResolvedValue({
      candidates: [{ target: 'app.celery:celery_app', file: 'app/celery.py' }],
      python_candidates: [],
      has_pyproject_toml: false,
      has_requirements_txt: false,
      has_pipfile: false,
      has_poetry_lock: false,
      has_uv_lock: false,
    });
    show();

    await operator.type(screen.getByLabelText('Application directory to scan'), '/opt/docai/backend');
    await operator.click(screen.getByRole('button', { name: 'Scan' }));
    await operator.click(await screen.findByText('app.celery:celery_app'));

    expect(createOperation).not.toHaveBeenCalled();
  });

  it('runs a live preflight and shows the real evidence behind each check', async () => {
    const operator = userEvent.setup();
    const checks: CeleryCheck[] = [
      { name: 'Python environment found', passed: true, detail: 'the python executable ran and reported a version' },
      {
        name: 'Celery application imported',
        passed: false,
        detail: "ModuleNotFoundError: No module named 'app'",
      },
    ];
    preflightCelery.mockResolvedValue(checks);
    show();

    await operator.type(screen.getByLabelText('Working directory'), '/opt/docai/backend');
    await operator.type(screen.getByLabelText('Python executable'), '/opt/docai/backend/.venv/bin/python');
    await operator.type(screen.getByLabelText('Celery application'), 'app.celery:celery_app');
    await operator.type(screen.getByLabelText('Broker URL'), 'redis://localhost:6379/0');
    await operator.click(screen.getByRole('button', { name: 'Check this configuration' }));

    expect(await screen.findByText('Python environment found')).toBeInTheDocument();
    expect(screen.getByText("ModuleNotFoundError: No module named 'app'")).toBeInTheDocument();
    expect(preflightCelery).toHaveBeenCalledWith('service-1', {
      working_directory: '/opt/docai/backend',
      python_executable: '/opt/docai/backend/.venv/bin/python',
      celery_app: 'app.celery:celery_app',
      broker_url: 'redis://localhost:6379/0',
      result_backend: undefined,
    });
  });

  it('starts an ordinary Operation on submit and opens its plan', async () => {
    const operator = userEvent.setup();
    createOperation.mockResolvedValue({ id: 'op-123' });
    show();

    await operator.type(screen.getByLabelText('Working directory'), '/opt/docai/backend');
    await operator.type(screen.getByLabelText('Python executable'), '/opt/docai/backend/.venv/bin/python');
    await operator.type(screen.getByLabelText('Celery application'), 'app.celery:celery_app');
    await operator.type(screen.getByLabelText('Broker URL'), 'redis://localhost:6379/0');
    await operator.click(screen.getByRole('button', { name: 'Configure and start this worker' }));

    await waitFor(() => expect(createOperation).toHaveBeenCalled());
    const [input] = createOperation.mock.calls[0] as [Record<string, unknown>];
    expect(input.node_id).toBe('node-1');
    expect(input.capability_key).toBe('configure-celery-worker');
    expect(await screen.findByText('Operation detail page')).toBeInTheDocument();
  });

  it('shows a command preview once enough fields are filled', async () => {
    const operator = userEvent.setup();
    show();

    expect(screen.queryByText(/Preview -- the command/)).toBeNull();
    await operator.type(screen.getByLabelText('Python executable'), '/opt/docai/backend/.venv/bin/python');
    await operator.type(screen.getByLabelText('Celery application'), 'app.celery:celery_app');

    expect(await screen.findByText(/Preview -- the command/)).toBeInTheDocument();
    expect(screen.getByText(/celery -A app\.celery:celery_app worker/)).toBeInTheDocument();
  });
});

describe('CeleryManager: already configured', () => {
  it('shows the current configuration rather than the discovery form', () => {
    show({ operations: [configuredOperation()] });

    expect(screen.getByText('This worker is configured')).toBeInTheDocument();
    expect(screen.getByText('/opt/docai/backend')).toBeInTheDocument();
    expect(screen.getByText('app.celery:celery_app')).toBeInTheDocument();
    expect(screen.queryByLabelText('Application directory to scan')).toBeNull();
  });

  it('links each lifecycle action to its own Capability page, prefilled with this worker', async () => {
    const operator = userEvent.setup();
    show({ operations: [configuredOperation()] });

    await operator.click(screen.getByRole('button', { name: 'Start' }));

    expect(await screen.findByText(/Capability page:/)).toBeInTheDocument();
    expect(screen.getByText(/node=node-1/)).toBeInTheDocument();
    expect(screen.getByText(/working_directory=%2Fopt%2Fdocai%2Fbackend/)).toBeInTheDocument();
  });

  it('lets an Operator change the configuration without losing the discovery/preflight form', async () => {
    const operator = userEvent.setup();
    show({ operations: [configuredOperation()] });

    await operator.click(screen.getByRole('button', { name: 'Change configuration' }));

    expect(await screen.findByLabelText('Working directory')).toHaveValue('/opt/docai/backend');
  });

  it('sends a real test task and shows the real evidence behind the result', async () => {
    const operator = userEvent.setup();
    const check: CeleryCheck = {
      name: 'Task round-trip',
      passed: true,
      detail: 'a real task was sent to the "celery" queue, picked up, executed, and its result read back',
    };
    sendCeleryTestTask.mockResolvedValue(check);
    show({ operations: [configuredOperation()] });

    await operator.click(screen.getByRole('button', { name: 'Send a test task' }));

    expect(sendCeleryTestTask).toHaveBeenCalledWith('service-1', {
      working_directory: '/opt/docai/backend',
      python_executable: '/opt/docai/backend/.venv/bin/python',
      celery_app: 'app.celery:celery_app',
      result_backend: '',
      queues: 'celery',
    });
    expect(await screen.findByText('Task round-trip')).toBeInTheDocument();
    expect(screen.getByText(/picked up, executed, and its result read back/)).toBeInTheDocument();
  });

  it('shows the real failure when a test task never completes', async () => {
    const operator = userEvent.setup();
    sendCeleryTestTask.mockResolvedValue({
      name: 'Task round-trip',
      passed: false,
      detail: 'celery.exceptions.TimeoutError: The operation timed out.',
    });
    show({ operations: [configuredOperation()] });

    await operator.click(screen.getByRole('button', { name: 'Send a test task' }));

    expect(await screen.findByText(/TimeoutError/)).toBeInTheDocument();
  });

  it('reads queue depth with the queues and threshold this worker was configured with', async () => {
    const operator = userEvent.setup();
    runCapabilityAction.mockResolvedValue({
      columns: ['Queue', 'Pending tasks', 'Active tasks', 'Diagnosis'],
      rows: [['celery', '150', '0', 'this queue looks stuck, not merely busy.']],
    });
    show({ operations: [configuredOperation()] });

    await operator.click(screen.getByRole('button', { name: 'Queue depth' }));

    expect(await screen.findByText('150')).toBeInTheDocument();
    expect(screen.getByText(/stuck/)).toBeInTheDocument();
    expect(runCapabilityAction).toHaveBeenCalledWith('inspect-celery-worker', 'queue-depth', {
      node_id: 'node-1',
      service_id: 'service-1',
      parameters: {
        working_directory: '/opt/docai/backend',
        python_executable: '/opt/docai/backend/.venv/bin/python',
        celery_app: 'app.celery:celery_app',
        queues: 'celery',
        threshold: '100',
      },
    });
  });

  it('re-reads queue depth when the Operator changes the threshold', async () => {
    const operator = userEvent.setup();
    runCapabilityAction.mockResolvedValue({ columns: [], rows: [] });
    show({ operations: [configuredOperation()] });

    await operator.click(screen.getByRole('button', { name: 'Queue depth' }));
    await screen.findByLabelText('Pending-task threshold');
    await operator.clear(screen.getByLabelText('Pending-task threshold'));
    await operator.type(screen.getByLabelText('Pending-task threshold'), '25');

    await waitFor(() =>
      expect(runCapabilityAction).toHaveBeenCalledWith(
        'inspect-celery-worker',
        'queue-depth',
        expect.objectContaining({ parameters: expect.objectContaining({ threshold: '25' }) }),
      ),
    );
  });

  it('shows the application’s own raw task routing, never a resolved answer', async () => {
    const operator = userEvent.setup();
    runCapabilityAction.mockResolvedValue({
      columns: ['Task pattern', 'Routes to queue'],
      rows: [
        ['(default -- everything not matched below)', 'celery'],
        ['app.tasks.urgent.*', 'priority'],
      ],
    });
    show({ operations: [configuredOperation()] });

    await operator.click(screen.getByRole('button', { name: 'Task routing' }));

    expect(await screen.findByText('app.tasks.urgent.*')).toBeInTheDocument();
    expect(screen.getByText('priority')).toBeInTheDocument();
    expect(runCapabilityAction).toHaveBeenCalledWith('inspect-celery-worker', 'task-routing', {
      node_id: 'node-1',
      service_id: 'service-1',
      parameters: {
        working_directory: '/opt/docai/backend',
        python_executable: '/opt/docai/backend/.venv/bin/python',
        celery_app: 'app.celery:celery_app',
      },
    });
  });
});
