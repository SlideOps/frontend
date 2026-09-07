import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { DiscoveryRepair } from '@slideops/api-client';
import { renderInApp } from '../../test/render';
import { DiscoveryRepairs } from './DiscoveryRepairs';

/** The outage this exists for: a nip.io address that answered nobody. */
function repair(over: Partial<DiscoveryRepair> = {}): DiscoveryRepair {
  return {
    service_id: 'svc-1',
    service_name: 'frc-api',
    problem: 'frc.187.7.20.156.nip.io had nothing listening on 80 and 443 to answer it',
    repairing: true,
    ...over,
  };
}

describe('DiscoveryRepairs', () => {
  it('says what it found and that it is fixing it', () => {
    renderInApp(<DiscoveryRepairs repairs={[repair()]} />);

    expect(screen.getByText(/putting one thing right/i)).toBeInTheDocument();
    expect(screen.getByText('frc-api')).toBeInTheDocument();
    expect(screen.getByText(/nothing listening on 80 and 443/i)).toBeInTheDocument();
    // SlideOps acting on its own has to be followable, never silent.
    expect(screen.getByText(/follow in History/i)).toBeInTheDocument();
  });

  it('counts several repairs', () => {
    renderInApp(
      <DiscoveryRepairs
        repairs={[repair(), repair({ service_id: 'svc-2', service_name: 'frc-web' })]}
      />,
    );

    expect(screen.getByText(/putting 2 things right/i)).toBeInTheDocument();
  });

  it('renders nothing when a problem was found but no repair started', () => {
    const { container } = renderInApp(
      <DiscoveryRepairs repairs={[repair({ repairing: false })]} />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when a rediscovery found nothing wrong', () => {
    const { container } = renderInApp(<DiscoveryRepairs repairs={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
