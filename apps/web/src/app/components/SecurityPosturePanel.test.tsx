import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import type { CapabilityState } from '@slideops/api-client';
import { renderInApp } from '../../test/render';
import { SecurityPosturePanel } from './SecurityPosturePanel';

const navigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useNavigate: () => navigate,
}));

function done(): CapabilityState {
  return { status: 'done', source: 'slideops', last_operation_id: 'op-1', last_completed_at: '2026-01-01T00:00:00Z' };
}

function show(states: Record<string, CapabilityState>) {
  return renderInApp(
    <MemoryRouter>
      <SecurityPosturePanel states={states} nodeId="n1" projectId="p1" />
    </MemoryRouter>,
  );
}

describe('SecurityPosturePanel', () => {
  it('shows all four security items even when none are set up', () => {
    show({});
    expect(screen.getByText('Fail2ban')).toBeInTheDocument();
    expect(screen.getByText('Automatic security updates')).toBeInTheDocument();
    expect(screen.getByText('Key-only SSH')).toBeInTheDocument();
    expect(screen.getByText('Server audit')).toBeInTheDocument();
    expect(screen.getAllByText('Not set up yet')).toHaveLength(4);
  });

  it('shows a completed item as done rather than not set up', () => {
    show({ 'install-fail2ban': done() });
    expect(screen.getByText(/^Done/)).toBeInTheDocument();
    expect(screen.getAllByText('Not set up yet')).toHaveLength(3);
  });

  it('navigates to the Capability page when a row is chosen', async () => {
    const operator = userEvent.setup();
    show({});
    await operator.click(screen.getByText('Fail2ban'));
    expect(navigate).toHaveBeenCalledWith('/app/capabilities/install-fail2ban?node=n1&project=p1');
  });
});
