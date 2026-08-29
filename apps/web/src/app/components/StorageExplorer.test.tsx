import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { renderInApp } from '../../test/render';

/*
 * A bucket-then-object browser for MinIO, in the same Tree-plus-grid shape
 * DatabaseExplorer already uses. What matters here is that picking a bucket
 * from the Tree fetches that bucket's objects with the right parameter, and
 * that an empty server reads as "no buckets" rather than a blank screen.
 */

const runCapabilityAction = vi.fn();

vi.mock('@slideops/api-client', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  runCapabilityAction: (...args: unknown[]) => runCapabilityAction(...args),
}));

const { StorageExplorer, isStorageCapability } = await import('./StorageExplorer');

function show() {
  return renderInApp(
    <MemoryRouter>
      <StorageExplorer capabilityKey="install-minio" nodeId="n1" />
    </MemoryRouter>,
  );
}

describe('isStorageCapability', () => {
  it('recognizes only MinIO', () => {
    expect(isStorageCapability('install-minio')).toBe(true);
    expect(isStorageCapability('install-meilisearch')).toBe(false);
  });
});

describe('StorageExplorer', () => {
  beforeEach(() => {
    runCapabilityAction.mockReset();
  });

  it('lists buckets in the tree, then objects once one is picked', async () => {
    runCapabilityAction.mockImplementation((_key: string, action: string) => {
      if (action === 'list-buckets') {
        return Promise.resolve({ columns: ['Bucket', 'Created'], rows: [['photos', '2026-01-01']] });
      }
      return Promise.resolve({ columns: ['Object', 'Size', 'Last modified'], rows: [['a.txt', '3 B', '2026-01-01']] });
    });
    const operator = userEvent.setup();
    show();

    await operator.click(await screen.findByText('photos'));
    expect(await screen.findByText('a.txt')).toBeInTheDocument();
    expect(runCapabilityAction).toHaveBeenCalledWith('install-minio', 'list-objects', {
      node_id: 'n1',
      service_id: undefined,
      parameters: { bucket: 'photos' },
    });
  });

  it('says plainly when there are no buckets yet', async () => {
    runCapabilityAction.mockResolvedValue({ columns: ['Bucket', 'Created'], rows: [] });
    show();
    expect(await screen.findByText('No buckets yet')).toBeInTheDocument();
  });

  it('prompts to pick a bucket before anything is selected', async () => {
    runCapabilityAction.mockResolvedValue({ columns: ['Bucket', 'Created'], rows: [['photos', '2026-01-01']] });
    show();
    expect(await screen.findByText('Pick a bucket to browse what is inside it.')).toBeInTheDocument();
  });
});
