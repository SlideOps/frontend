import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  cancelSubscription,
  createPromoCode,
  deletePromoCode,
  getSubscription,
  listPromoCodes,
  setPromoCodeEnabled,
  startCheckout,
  validatePromo,
} from './billing';

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

describe('billing requests', () => {
  it('reads the subscription over the billing path with cookies included', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(200, {
        configured: true,
        subscription: { tier: 'pro', provider: 'paystack', status: 'active' },
      }),
    );

    const result = await getSubscription();

    expect(result.configured).toBe(true);
    expect(result.subscription?.tier).toBe('pro');
    const init = fetchMock.mock.calls[0]?.[1];
    expect(init?.credentials).toBe('include');
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/api/v1/billing/subscription');
  });

  it('reads a subscription of null when the Operator has never subscribed', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(200, { configured: false, subscription: null }),
    );

    const result = await getSubscription();
    expect(result.configured).toBe(false);
    expect(result.subscription).toBeNull();
  });

  it('starts a checkout and returns the provider checkout URL', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(200, {
        checkout_url: 'https://pay.example/redirect',
        reference: 'ref_1',
        provider: 'flutterwave',
        granted: false,
      }),
    );

    const result = await startCheckout({
      tier: 'starter',
      provider: 'flutterwave',
      promo_code: 'WELCOME',
      term_months: 3,
    });

    expect(result.checkout_url).toBe('https://pay.example/redirect');
    expect(result.granted).toBe(false);
    const init = fetchMock.mock.calls[0]?.[1];
    expect(init?.method).toBe('POST');
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/api/v1/billing/checkout');
    const sent = JSON.parse(String(init?.body)) as {
      tier: string;
      provider: string;
      promo_code: string;
      term_months: number;
    };
    expect(sent.tier).toBe('starter');
    expect(sent.provider).toBe('flutterwave');
    expect(sent.promo_code).toBe('WELCOME');
    expect(sent.term_months).toBe(3);
  });

  it('cancels the subscription as a POST', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse(204, undefined));

    await cancelSubscription();

    const init = fetchMock.mock.calls[0]?.[1];
    expect(init?.method).toBe('POST');
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/api/v1/billing/cancel');
  });

  it('validates a promo code and unwraps the preview envelope', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(200, {
        promo: {
          code: 'WELCOME',
          tier: 'pro',
          currency: 'USD',
          term_months: 1,
          original_amount_minor: 4900,
          discounted_amount_minor: 3920,
          free_grant: false,
          bonus_nodes: 0,
          bonus_projects: 0,
          bonus_seats: 0,
          descriptions: ['20% off'],
        },
      }),
    );

    const preview = await validatePromo({ code: 'WELCOME', tier: 'pro' });

    expect(preview.discounted_amount_minor).toBe(3920);
    expect(preview.descriptions[0]).toBe('20% off');
    const init = fetchMock.mock.calls[0]?.[1];
    expect(init?.method).toBe('POST');
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/api/v1/billing/promo/validate');
  });
});

describe('admin promo-code requests', () => {
  it('lists promo codes and unwraps the named array', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(200, {
        promo_codes: [{ id: 'pc_1', code: 'WELCOME', enabled: true, effects: [] }],
      }),
    );

    const codes = await listPromoCodes();

    expect(codes).toHaveLength(1);
    expect(codes[0]?.code).toBe('WELCOME');
    const init = fetchMock.mock.calls[0]?.[1];
    expect(init?.credentials).toBe('include');
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/api/v1/admin/promo-codes');
  });

  it('creates a promo code and unwraps the created envelope', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(201, {
        promo_code: { id: 'pc_2', code: 'LAUNCH', enabled: true, effects: [] },
      }),
    );

    const created = await createPromoCode({
      code: 'LAUNCH',
      effects: [{ kind: 'percent_discount', percent: 25 }],
    });

    expect(created.id).toBe('pc_2');
    const init = fetchMock.mock.calls[0]?.[1];
    expect(init?.method).toBe('POST');
    const sent = JSON.parse(String(init?.body)) as { effects: { kind: string; percent: number }[] };
    expect(sent.effects[0]?.kind).toBe('percent_discount');
    expect(sent.effects[0]?.percent).toBe(25);
  });

  it('enables and disables a promo code over the matching path', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse(200, undefined));

    await setPromoCodeEnabled('pc_3', true);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/api/v1/admin/promo-codes/pc_3/enable');
    expect(fetchMock.mock.calls[0]?.[1]?.method).toBe('POST');

    await setPromoCodeEnabled('pc_3', false);
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain(
      '/api/v1/admin/promo-codes/pc_3/disable',
    );
  });

  it('deletes a promo code as a DELETE', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse(204, undefined));

    await deletePromoCode('pc_4');

    const init = fetchMock.mock.calls[0]?.[1];
    expect(init?.method).toBe('DELETE');
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/api/v1/admin/promo-codes/pc_4');
  });
});
