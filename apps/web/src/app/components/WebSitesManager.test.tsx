import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { renderInApp } from '../../test/render';

/*
 * A thin wrapper over the shared ActionTable, covered directly in
 * ActionTable.test.tsx. What is worth pinning here is only the wiring: the
 * right Action key reaches the right Capability, for every engine this
 * category covers.
 */

const runCapabilityAction = vi.fn();

vi.mock('@slideops/api-client', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  runCapabilityAction: (...args: unknown[]) => runCapabilityAction(...args),
}));

const { WebSitesManager, isWebSitesCapability } = await import('./WebSitesManager');

describe('isWebSitesCapability', () => {
  it('recognizes nginx, Apache, and HAProxy, and nothing else', () => {
    expect(isWebSitesCapability('install-nginx')).toBe(true);
    expect(isWebSitesCapability('install-apache')).toBe(true);
    expect(isWebSitesCapability('install-haproxy')).toBe(true);
    expect(isWebSitesCapability('install-minio')).toBe(false);
  });
});

describe('WebSitesManager', () => {
  it('asks for list-sites on the given Capability', async () => {
    runCapabilityAction.mockResolvedValue({ columns: ['Site', 'Server name', 'Listens on'], rows: [['site-a', 'a.example.com', '443']] });
    renderInApp(
      <MemoryRouter>
        <WebSitesManager capabilityKey="install-nginx" nodeId="n1" />
      </MemoryRouter>,
    );
    expect(await screen.findByText('site-a')).toBeInTheDocument();
    expect(runCapabilityAction).toHaveBeenCalledWith('install-nginx', 'list-sites', {
      node_id: 'n1',
      service_id: undefined,
      parameters: undefined,
    });
  });
});
