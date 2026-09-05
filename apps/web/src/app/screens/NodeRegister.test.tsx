import { screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Project, SSHKey } from '@slideops/api-client';
import { renderInApp } from '../../test/render';

/*
 * The real friction this locks in: a first-time Operator with zero saved
 * keys was shown a "Use a saved key" choice anyway -- visibly disabled, but
 * still a decision to notice, read, and dismiss -- before reaching the one
 * field that actually mattered. That is one extra decision for the
 * overwhelmingly common case of nothing saved yet. The choice should not
 * exist at all until there is a real key to choose.
 */

let savedKeys: SSHKey[] = [];
const projects: Project[] = [];

vi.mock('@slideops/api-client', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  listProjects: async () => projects,
  listSSHKeys: async () => savedKeys,
  createNode: vi.fn(),
  importSSHKey: vi.fn(),
}));

const { NodeRegister } = await import('./NodeRegister');

function show() {
  return renderInApp(
    <MemoryRouter>
      <NodeRegister />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  savedKeys = [];
});

describe('NodeRegister credential source', () => {
  it('skips the credential-source choice entirely with no saved keys', async () => {
    show();

    await screen.findByText('How to sign in');
    expect(screen.queryByText('Credential')).not.toBeInTheDocument();
    expect(screen.queryByText('Use a saved key')).not.toBeInTheDocument();
  });

  it('offers the credential-source choice once a key is saved', async () => {
    savedKeys = [
      { id: 'key-1', name: 'deploy key', fingerprint: 'SHA256:abc', created_at: '2026-09-01T00:00:00Z' },
    ];
    show();

    await screen.findByText('Credential');
    expect(screen.getByText('Use a saved key')).toBeInTheDocument();
    expect(screen.getByText('Paste a credential')).toBeInTheDocument();
  });
});
