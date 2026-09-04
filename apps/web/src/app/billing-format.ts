/** Render an amount held in the smallest currency unit for display. Shared by
 *  every billing-related screen (the plan checkout, Recent Transactions, and
 *  the Transactions center) so a price never renders two different ways. */
export function formatMoney(minor: number, currency?: string): string {
  const major = minor / 100;
  if (currency) {
    try {
      return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(major);
    } catch {
      // An unknown currency code falls back to a plain amount with the code.
      return `${major.toLocaleString()} ${currency}`;
    }
  }
  return major.toLocaleString();
}
