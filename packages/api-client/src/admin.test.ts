import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from './errors';
import {
  getOverview,
  listAdminOperations,
  listAdminTiers,
  pauseSubscriber,
  recoverPayment,
  resendPaymentReceipt,
  resumeSubscriber,
  suspendOperator,
  updateAdminTier,
  verifyPayment,
} from './admin';

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

describe('admin requests', () => {
  it('reads the overview over the admin path with cookies included', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(200, {
        overview: {
          operators_total: 4,
          nodes_total: 12,
          operations_total: 88,
          operations_by_status: { completed: 70, failed: 3 },
          active_operations: 2,
          failures_last_24h: 1,
          executions_paused: false,
          operators_suspended: 1,
        },
      }),
    );

    const overview = await getOverview();

    expect(overview.operators_total).toBe(4);
    expect(overview.operators_suspended).toBe(1);
    expect(overview.executions_paused).toBe(false);
    const init = fetchMock.mock.calls[0]?.[1];
    expect(init?.credentials).toBe('include');
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/api/v1/admin/overview');
  });

  it('unwraps a bare overview body when the envelope key is absent', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(200, {
        operators_total: 1,
        nodes_total: 1,
        operations_total: 1,
        operations_by_status: {},
        active_operations: 0,
        failures_last_24h: 0,
        executions_paused: true,
        operators_suspended: 0,
      }),
    );

    const overview = await getOverview();
    expect(overview.executions_paused).toBe(true);
    expect(overview.operators_total).toBe(1);
  });

  it('sends the status and operator filters when listing Operations', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(jsonResponse(200, { operations: [] }));

    await listAdminOperations({ status: 'failed', operator_id: 'op_9' });

    const calledUrl = String(fetchMock.mock.calls[0]?.[0]);
    expect(calledUrl).toContain('status=failed');
    expect(calledUrl).toContain('operator_id=op_9');
  });

  it('posts a suspend as an audited mutation', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse(204, undefined));

    await suspendOperator('op_3');

    const init = fetchMock.mock.calls[0]?.[1];
    expect(init?.method).toBe('POST');
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/api/v1/admin/operators/op_3/suspend');
  });

  it('reads a payment reconciliation report and unwraps the envelope', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(200, {
        reconciliation: {
          reference: 'pay_1',
          local_status: 'failed',
          provider_status: 'success',
          match: false,
        },
      }),
    );

    const report = await verifyPayment('pay_1');

    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/admin/payments/pay_1/verify');
    expect(report).toEqual({
      reference: 'pay_1',
      local_status: 'failed',
      provider_status: 'success',
      match: false,
    });
  });

  it('posts a recovery with its reason and unwraps the returned payment', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(200, {
        payment: { reference: 'pay_1', status: 'success', recovered_at: '2026-09-03T00:00:00Z' },
      }),
    );

    const payment = await recoverPayment('pay_1', 'Provider confirmed success');

    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(String(url)).toContain('/admin/payments/pay_1/recover');
    expect(init?.method).toBe('POST');
    expect(JSON.parse(String(init?.body))).toEqual({ reason: 'Provider confirmed success' });
    expect(payment.status).toBe('success');
  });

  it('posts a receipt resend and unwraps the returned payment', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(200, { payment: { reference: 'pay_1', status: 'success' } }),
    );

    await resendPaymentReceipt('pay_1');

    const init = fetchMock.mock.calls[0]?.[1];
    expect(init?.method).toBe('POST');
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain(
      '/admin/payments/pay_1/resend-receipt',
    );
  });

  it('posts a pause with its reason and unwraps the returned subscription', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(200, {
        subscription: { tier: 'free', status: 'paused', paused_previous_tier: 'pro' },
      }),
    );

    const sub = await pauseSubscriber('op-1', 'payment dispute');

    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(String(url)).toContain('/admin/subscribers/op-1/pause');
    expect(init?.method).toBe('POST');
    expect(JSON.parse(String(init?.body))).toEqual({
      reason: 'payment dispute',
      resume_at: undefined,
    });
    expect(sub.status).toBe('paused');
    expect(sub.paused_previous_tier).toBe('pro');
  });

  it('sends resume_at as an ISO timestamp when given', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(jsonResponse(200, { subscription: { tier: 'free', status: 'paused' } }));

    await pauseSubscriber('op-1', 'temporary hold', new Date('2026-10-01T00:00:00.000Z'));

    const init = fetchMock.mock.calls[0]?.[1];
    expect(JSON.parse(String(init?.body))).toEqual({
      reason: 'temporary hold',
      resume_at: '2026-10-01T00:00:00.000Z',
    });
  });

  it('posts a resume and unwraps the restored subscription', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(jsonResponse(200, { subscription: { tier: 'pro', status: 'active' } }));

    const sub = await resumeSubscriber('op-1');

    const init = fetchMock.mock.calls[0]?.[1];
    expect(init?.method).toBe('POST');
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/admin/subscribers/op-1/resume');
    expect(sub.tier).toBe('pro');
  });

  it('lists tiers over the admin path with cookies and unwraps the array', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(200, {
        tiers: [
          {
            name: 'pro',
            nodes: 10,
            projects: 5,
            seats: 3,
            history_days: 90,
            automations: true,
            advanced_monitoring: true,
            audit_trail: true,
            amount_minor: 750000,
            currency: 'NGN',
            purchasable: true,
          },
          {
            name: 'enterprise',
            nodes: -1,
            projects: -1,
            seats: -1,
            history_days: -1,
            automations: true,
            advanced_monitoring: true,
            audit_trail: true,
            amount_minor: 0,
            currency: 'NGN',
            purchasable: false,
          },
        ],
      }),
    );

    const tiers = await listAdminTiers();

    expect(tiers).toHaveLength(2);
    expect(tiers[0]?.name).toBe('pro');
    expect(tiers[0]?.amount_minor).toBe(750000);
    expect(tiers[1]?.nodes).toBe(-1);
    const init = fetchMock.mock.calls[0]?.[1];
    expect(init?.credentials).toBe('include');
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/api/v1/admin/tiers');
  });

  it('puts a tier update to the named path and unwraps the returned tier', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(200, {
        tier: {
          name: 'starter',
          nodes: 3,
          projects: 2,
          seats: 1,
          history_days: 30,
          automations: false,
          advanced_monitoring: false,
          audit_trail: false,
          amount_minor: 250000,
          currency: 'NGN',
          purchasable: true,
        },
      }),
    );

    const updated = await updateAdminTier('starter', {
      nodes: 3,
      projects: 2,
      seats: 1,
      history_days: 30,
      automations: false,
      advanced_monitoring: false,
      audit_trail: false,
      amount_minor: 250000,
      currency: 'NGN',
      purchasable: true,
    });

    expect(updated.name).toBe('starter');
    expect(updated.amount_minor).toBe(250000);
    const init = fetchMock.mock.calls[0]?.[1];
    expect(init?.method).toBe('PUT');
    expect(init?.credentials).toBe('include');
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/api/v1/admin/tiers/starter');
    const sent = JSON.parse(String(init?.body)) as { nodes: number; amount_minor: number };
    expect(sent.nodes).toBe(3);
    expect(sent.amount_minor).toBe(250000);
  });

  it('surfaces a 400 invalid value when updating a tier', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(400, {
        error: { code: 'invalid_nodes', message: 'nodes must be at least -1' },
      }),
    );

    await expect(
      updateAdminTier('pro', {
        nodes: -5,
        projects: 5,
        seats: 3,
        history_days: 90,
        automations: true,
        advanced_monitoring: true,
        audit_trail: true,
        amount_minor: 750000,
        currency: 'NGN',
        purchasable: true,
      }),
    ).rejects.toMatchObject({ status: 400, code: 'invalid_nodes' });

    await expect(
      updateAdminTier('pro', {
        nodes: -5,
        projects: 5,
        seats: 3,
        history_days: 90,
        automations: true,
        advanced_monitoring: true,
        audit_trail: true,
        amount_minor: 750000,
        currency: 'NGN',
        purchasable: true,
      }),
    ).rejects.toBeInstanceOf(ApiError);
  });
});
