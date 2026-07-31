import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchLivePrices, formatPrice } from './live-pricing';

/*
The pricing page reading what the platform will actually charge.

Its numbers were written in and disagreed with checkout for a while: the page
said $19 while billing held NGN 7,500. The page is the offer somebody accepts,
so the charge has to be the thing they agreed to.

What matters most here is the fallback. This is the first thing a visitor sees,
and a page that renders nothing because an API call failed is worse than one
showing a price that is very nearly always right.
*/

afterEach(() => {
  vi.unstubAllGlobals();
});

function respondWith(body: unknown, ok = true) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({ ok, json: async () => body } as unknown as Response),
  );
}

describe('formatPrice', () => {
  it('writes a whole amount without trailing zeros', () => {
    expect(formatPrice(1900, 'USD')).toBe('$19');
    expect(formatPrice(4900, 'USD')).toBe('$49');
  });

  it('keeps the cents when there are any', () => {
    expect(formatPrice(1950, 'USD')).toBe('$19.50');
  });

  // An unknown currency code must not take the page down.
  it('still renders something for a currency it does not know', () => {
    expect(formatPrice(1900, 'XXQ')).toContain('19');
  });
});

describe('fetchLivePrices', () => {
  it('reads the price of every purchasable tier', async () => {
    respondWith({
      tiers: [
        { name: 'starter', amount_minor: 1900, currency: 'USD', purchasable: true },
        { name: 'pro', amount_minor: 4900, currency: 'USD', purchasable: true },
      ],
    });
    await expect(fetchLivePrices()).resolves.toEqual({ starter: '$19', pro: '$49' });
  });

  // Free and Enterprise carry no price to show, so they must not overwrite the
  // copy the page ships with, which says "$0" and "Custom".
  it('ignores a tier that is not sold self serve', async () => {
    respondWith({
      tiers: [
        { name: 'free', amount_minor: 0, currency: 'USD', purchasable: false },
        { name: 'enterprise', amount_minor: 0, currency: 'USD', purchasable: false },
        { name: 'pro', amount_minor: 4900, currency: 'USD', purchasable: true },
      ],
    });
    await expect(fetchLivePrices()).resolves.toEqual({ pro: '$49' });
  });

  /*
   * Every one of these falls back rather than throwing, because the caller
   * renders the shipped price on an empty result. A marketing page must survive
   * an unhappy API.
   */
  it.each([
    ['the request fails', () => vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('down')))],
    ['the status is not ok', () => respondWith({ tiers: [] }, false)],
    ['the body is not what we expect', () => respondWith({ nonsense: true })],
    ['tiers is not a list', () => respondWith({ tiers: 'soon' })],
    ['a tier is missing its amount', () => respondWith({ tiers: [{ name: 'pro', purchasable: true }] })],
  ])('falls back when %s', async (_label, arrange) => {
    arrange();
    await expect(fetchLivePrices()).resolves.toEqual({});
  });
});
