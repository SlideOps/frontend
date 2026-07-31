/*
The prices the platform will actually charge.

The pricing page had its numbers written into it, and for a while they disagreed
with what checkout charged: the page said $19 while billing held NGN 7,500. A
disagreement in that particular place is not cosmetic, because the page is the
offer somebody accepts and the charge has to be the thing they agreed to.

Correcting both once fixes today and not tomorrow, since an Admin can change a
price from the control plane at any time. So the page asks the platform.

The written-in prices stay as the fallback, deliberately. A marketing page that
renders nothing because an API call failed is worse than one showing a price that
is very nearly always right, and this page is the first thing a visitor sees.
*/

/** One tier as the platform reports it. */
export interface LivePrice {
  name: string;
  amount_minor: number;
  currency: string;
  purchasable: boolean;
}

/** How a minor-unit amount is written for a human: 1900 USD becomes "$19". */
export function formatPrice(amountMinor: number, currency: string): string {
  const major = amountMinor / 100;
  // Whole amounts read better without the trailing zeros, and every price the
  // platform ships is whole. A fractional one still renders correctly.
  const digits = Number.isInteger(major) ? 0 : 2;
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(major);
  } catch {
    // An unknown currency code should not take the page down.
    return `${currency} ${major.toFixed(digits)}`;
  }
}

/**
 * Read the live price list.
 *
 * Returns a map from tier name to its formatted price. An empty map means the
 * page should use what it was shipped with, which is the case whenever the API
 * is unreachable, the response is not what we expect, or a tier is not sold
 * self-serve and therefore has no price to show.
 */
export async function fetchLivePrices(signal?: AbortSignal): Promise<Record<string, string>> {
  try {
    const response = await fetch('/api/v1/pricing', { signal });
    if (!response.ok) {
      return {};
    }
    const payload: unknown = await response.json();
    const tiers = (payload as { tiers?: unknown })?.tiers;
    if (!Array.isArray(tiers)) {
      return {};
    }
    const prices: Record<string, string> = {};
    for (const raw of tiers) {
      const tier = raw as Partial<LivePrice>;
      if (
        typeof tier.name !== 'string' ||
        typeof tier.amount_minor !== 'number' ||
        typeof tier.currency !== 'string' ||
        !tier.purchasable
      ) {
        continue;
      }
      prices[tier.name.toLowerCase()] = formatPrice(tier.amount_minor, tier.currency);
    }
    return prices;
  } catch {
    // Includes the abort on unmount, which is not a failure worth reporting.
    return {};
  }
}
