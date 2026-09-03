import { afterEach, describe, expect, it, vi } from 'vitest';
import { getMaintenanceStatus } from './maintenance';

/** Build a Response-like stub for the mocked fetch. */
function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => (body === undefined ? '' : JSON.stringify(body)),
  } as unknown as Response;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('getMaintenanceStatus', () => {
  it('reads the public maintenance path and unwraps the boolean', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(jsonResponse(200, { maintenance: true }));

    const on = await getMaintenanceStatus();

    expect(on).toBe(true);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/api/v1/maintenance');
  });

  it('defaults to off when the field is absent', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse(200, {}));

    expect(await getMaintenanceStatus()).toBe(false);
  });
});
