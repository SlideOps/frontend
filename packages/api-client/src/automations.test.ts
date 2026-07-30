import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAutomation, listAutomations, runAutomation, updateAutomation } from './automations';

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

describe('automations requests', () => {
  it('lists Automations over the same origin with cookies included', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(200, {
        automations: [{ id: 'au_1', capability_key: 'secure-ssh', enabled: true }],
      }),
    );

    const automations = await listAutomations();

    expect(automations).toHaveLength(1);
    expect(automations[0]?.id).toBe('au_1');
    const init = fetchMock.mock.calls[0]?.[1];
    expect(init?.credentials).toBe('include');
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/api/v1/automations');
  });

  it('unwraps a bare list when the envelope is absent', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(200, [{ id: 'au_9', capability_key: 'enable-https', enabled: false }]),
    );

    const automations = await listAutomations();
    expect(automations[0]?.id).toBe('au_9');
  });

  it('creates an Automation with a schedule and returns it', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(201, {
        automation: { id: 'au_2', schedule: { frequency: 'daily', time: '02:00' } },
      }),
    );

    const automation = await createAutomation({
      node_id: 'nd_1',
      capability_key: 'secure-ssh',
      schedule: { frequency: 'daily', time: '02:00' },
    });

    expect(automation.id).toBe('au_2');
    const init = fetchMock.mock.calls[0]?.[1];
    expect(init?.method).toBe('POST');
    const sent = JSON.parse(String(init?.body)) as { schedule: { frequency: string } };
    expect(sent.schedule.frequency).toBe('daily');
  });

  it('patches an Automation to toggle enabled', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(jsonResponse(200, { automation: { id: 'au_3', enabled: false } }));

    await updateAutomation('au_3', { enabled: false });

    const init = fetchMock.mock.calls[0]?.[1];
    expect(init?.method).toBe('PATCH');
  });

  it('runs an Automation now and returns the created Operation id', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(jsonResponse(202, { operation_id: 'op_5' }));

    const operationId = await runAutomation('au_4');

    expect(operationId).toBe('op_5');
    const init = fetchMock.mock.calls[0]?.[1];
    expect(init?.method).toBe('POST');
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/api/v1/automations/au_4/run');
  });
});
