import {
  ApiError,
  cancelSubscription,
  getSubscription,
  quoteCheckout,
  startCheckout,
  validatePromo,
  type PayCurrency,
  type PaymentProvider,
  type PromoPreview,
  type PurchasableTier,
  type Quote,
  type Subscription,
  type SubscriptionStatus,
} from '@slideops/api-client';
import { Button, Card, Text, cn } from '@slideops/design-system';
import { Check, CreditCard, Globe, Sparkles, TicketPercent } from '@slideops/icons';
import { EmptyState, PageHeader } from '@slideops/ui';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { isAdmin, useAuthStore } from '../../store/auth';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { ErrorNote, Loading } from '../components/Feedback';
import { OperatorShell } from '../components/OperatorShell';
import { useAsyncData } from '../hooks/useAsyncData';

/*
 * The Operator billing screen. It reads the current subscription and whether
 * billing is configured on this platform, shows the two self-serve plans, and
 * runs the upgrade: pick a provider, optionally preview a promo code, then start
 * a hosted checkout and hand the Operator to the provider. Admins are unlimited
 * by role and never subscribe, so they see a note instead of a checkout. Every
 * color here is a semantic token, so the screen reads correctly in both themes.
 */

interface PlanDescriptor {
  tier: PurchasableTier;
  name: string;
  price: string;
  cadence: string;
  blurb: string;
  includes: string;
  features: string[];
}

/** The two purchasable plans, described for the checkout surface. Prices are the
 *  headline monthly figure; the exact charge is confirmed at checkout and, with a
 *  promo, in the preview. */
const PLANS: PlanDescriptor[] = [
  {
    tier: 'starter',
    name: 'Starter',
    price: '$19',
    cadence: 'per month',
    blurb: 'A few Projects across a couple of servers.',
    includes: 'Everything in Free, plus',
    features: [
      '3 servers',
      '5 Projects',
      '2 seats',
      'Automations and scheduling',
      '30 days of history',
    ],
  },
  {
    tier: 'pro',
    name: 'Pro',
    price: '$49',
    cadence: 'per month',
    blurb: 'Run a real fleet, with your team.',
    includes: 'Everything in Starter, plus',
    features: [
      '15 servers',
      '30 Projects',
      '5 seats',
      'Advanced monitoring and reports',
      'Audit trail and 1 year of history',
    ],
  },
];

interface ProviderDescriptor {
  provider: PaymentProvider;
  name: string;
  helper: string;
  icon: typeof CreditCard;
}

const PROVIDERS: ProviderDescriptor[] = [
  {
    provider: 'paystack',
    name: 'Paystack',
    helper: 'Best for local cards and bank transfers.',
    icon: CreditCard,
  },
  {
    provider: 'flutterwave',
    name: 'Flutterwave',
    helper: 'Best for international cards and currencies.',
    icon: Globe,
  },
];

interface CurrencyDescriptor {
  currency: PayCurrency;
  name: string;
  helper: string;
}

interface TermOption {
  months: number;
  label: string;
}

/** How many months a checkout pays for at once: the ordinary monthly charge, or
 *  a full year and above paid straight through in one charge. The exact total
 *  is always the monthly price multiplied by the months chosen, confirmed by
 *  the quote below before committing; a first-time year-or-longer choice also
 *  earns the automatic annual discount, shown on that same quote. */
const TERM_OPTIONS: TermOption[] = [
  { months: 1, label: 'Monthly' },
  { months: 12, label: '1 year' },
  { months: 24, label: '2 years' },
  { months: 36, label: '3 years' },
];

// Dollar acceptance through Paystack is limited on our live account right now,
// so its checkout runs through our normal Naira conversion instead; the plan
// price stays in dollars regardless. Flip this back once dollar charges are
// confirmed working end to end again on that gateway.
const paystackUSDDisabled = true;

/** The currencies a gateway can actually charge right now. A gateway with more
 *  than one lets the Operator choose; one with exactly one charges it without
 *  asking, since there is nothing to choose between. */
function currenciesFor(provider: PaymentProvider): CurrencyDescriptor[] {
  if (provider === 'paystack') {
    const naira: CurrencyDescriptor = {
      currency: 'NGN',
      name: 'Naira',
      helper: 'Converted from the dollar price at the live exchange rate when you check out.',
    };
    if (paystackUSDDisabled) {
      return [naira];
    }
    return [{ currency: 'USD', name: 'US Dollar', helper: 'The plan price shown above.' }, naira];
  }
  // Flutterwave is the international gateway: dollars, at the plan's own price.
  return [{ currency: 'USD', name: 'US Dollar', helper: 'The plan price shown above.' }];
}

const statusLabel: Record<SubscriptionStatus, string> = {
  active: 'Active',
  canceled: 'Canceled',
  expired: 'Expired',
};

const statusTone: Record<SubscriptionStatus, string> = {
  active: 'text-success',
  canceled: 'text-warning',
  expired: 'text-danger',
};

const tierLabel: Record<string, string> = {
  free: 'Free',
  starter: 'Starter',
  pro: 'Pro',
  enterprise: 'Enterprise',
};

/** Render an amount held in the smallest currency unit for display. */
function formatMoney(minor: number, currency?: string): string {
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

/** A small inline badge for the subscription status, in semantic tokens only. */
function StatusBadge({ status }: { status: SubscriptionStatus }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-pill bg-subtle px-2.5 py-0.5 text-xs font-medium',
        statusTone[status],
      )}
    >
      {statusLabel[status]}
    </span>
  );
}

/** The current plan summary, shown when the Operator carries a subscription. */
function CurrentPlan({
  subscription,
  onCancel,
}: {
  subscription: Subscription;
  onCancel: () => void;
}) {
  const ended = subscription.status !== 'active';
  const periodLabel = ended ? 'Access until' : 'Renews';
  return (
    <Card>
      <div className="mb-4 flex items-center gap-2">
        <Sparkles width={18} height={18} className="text-brand" aria-hidden />
        <Text variant="h4">Current plan</Text>
        <div className="ml-auto">
          <StatusBadge status={subscription.status} />
        </div>
      </div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Text variant="h2">{tierLabel[subscription.tier] ?? subscription.tier}</Text>
          <Text variant="body-sm" tone="secondary" className="mt-1">
            Billed through {subscription.provider}
            {subscription.current_period_end
              ? `. ${periodLabel} ${new Date(subscription.current_period_end).toLocaleDateString()}.`
              : '.'}
          </Text>
        </div>
        {subscription.status === 'active' ? (
          <Button variant="secondary" onClick={onCancel}>
            Cancel plan
          </Button>
        ) : null}
      </div>
    </Card>
  );
}

/** One selectable plan card. Selecting it targets that tier for checkout. */
function PlanCard({
  plan,
  selected,
  current,
  disabled,
  onSelect,
}: {
  plan: PlanDescriptor;
  selected: boolean;
  current: boolean;
  disabled: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      aria-pressed={selected}
      className={cn(
        'flex h-full flex-col rounded-lg border bg-surface p-6 text-left transition-colors duration-fast ease-standard',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus',
        selected ? 'border-brand bg-brand-subtle' : 'border-border hover:bg-subtle',
        disabled ? 'cursor-not-allowed opacity-60' : '',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <Text variant="h4">{plan.name}</Text>
        {current ? (
          <span className="inline-flex items-center gap-1.5 rounded-pill bg-subtle px-2.5 py-0.5 text-xs font-medium text-success">
            <Check width={13} height={13} aria-hidden />
            Current
          </span>
        ) : null}
      </div>
      <div className="mt-2 flex items-baseline gap-1.5">
        <Text as="span" variant="h2">
          {plan.price}
        </Text>
        <Text as="span" variant="body-sm" tone="secondary">
          {plan.cadence}
        </Text>
      </div>
      <Text variant="body-sm" tone="secondary" className="mt-2">
        {plan.blurb}
      </Text>
      <Text variant="caption" tone="secondary" className="mt-4">
        {plan.includes}
      </Text>
      <ul className="mt-3 flex flex-col gap-2">
        {plan.features.map((feature) => (
          <li key={feature} className="flex items-center gap-2">
            <Check width={15} height={15} className="text-accent" aria-hidden />
            <Text as="span" variant="body-sm">
              {feature}
            </Text>
          </li>
        ))}
      </ul>
    </button>
  );
}

/** The promo preview panel: the described effects and the adjusted price. */
function PromoPreviewPanel({ preview }: { preview: PromoPreview }) {
  const discounted = preview.discounted_amount_minor < preview.original_amount_minor;
  return (
    <div className="rounded-lg border border-border bg-subtle p-4">
      <div className="flex items-center gap-2">
        <TicketPercent width={16} height={16} className="text-brand" aria-hidden />
        <Text as="span" variant="body-sm" className="font-medium">
          {preview.code.toUpperCase()} applied
        </Text>
      </div>
      {preview.descriptions.length > 0 ? (
        <ul className="mt-3 flex flex-col gap-1.5">
          {preview.descriptions.map((line, index) => (
            <li key={index} className="flex items-start gap-2">
              <Check width={14} height={14} className="mt-0.5 shrink-0 text-success" aria-hidden />
              <Text as="span" variant="body-sm" tone="secondary">
                {line}
              </Text>
            </li>
          ))}
        </ul>
      ) : null}
      {preview.free_grant ? (
        <Text variant="body-sm" className="mt-3 font-medium text-success">
          This code activates {tierLabel[preview.grant_tier ?? preview.tier] ?? preview.tier} free
          {preview.free_days ? ` for ${preview.free_days} days` : ''}, with no payment.
        </Text>
      ) : (
        <div className="mt-3 flex items-baseline gap-2">
          {discounted ? (
            <Text as="span" variant="body-sm" tone="secondary" className="line-through">
              {formatMoney(preview.original_amount_minor, preview.currency)}
            </Text>
          ) : null}
          <Text as="span" variant="h4">
            {formatMoney(preview.discounted_amount_minor, preview.currency)}
          </Text>
          {preview.term_months > 1 ? (
            <Text as="span" variant="body-sm" tone="secondary">
              for {preview.term_months} months
            </Text>
          ) : null}
        </div>
      )}
    </div>
  );
}

/** The itemized price panel: the plan subtotal, the automatic annual discount
 *  when it applies, the platform fee, the total, and the exchange rate when
 *  converted to Naira. Shown before the Operator commits to pay, so the fee,
 *  any conversion, and any savings are never a surprise at checkout. */
function PriceQuotePanel({ quote }: { quote: Quote }) {
  const discount = quote.annual_discount_minor ?? 0;
  const listPrice = quote.base_amount_minor + discount;
  return (
    <div className="rounded-lg border border-border bg-subtle p-4">
      {quote.annual_discount_applied && discount > 0 ? (
        <div className="mb-3 flex items-start gap-2 rounded-md border border-success/40 bg-surface px-3 py-2">
          <Sparkles width={15} height={15} className="mt-0.5 shrink-0 text-success" aria-hidden />
          <div>
            <Text variant="body-sm" className="font-medium text-success">
              You saved {formatMoney(discount, quote.currency)}
            </Text>
            <Text variant="caption" tone="secondary" className="mt-0.5 block">
              Your first-time discount for paying a full year or more straight through checkout.
              This applies once, the first time; after this it is not offered again.
            </Text>
          </div>
        </div>
      ) : null}
      <div className="flex items-center justify-between gap-2">
        <Text as="span" variant="body-sm" tone="secondary">
          Subtotal{quote.term_months > 1 ? ` (${quote.term_months} months)` : ''}
        </Text>
        <Text as="span" variant="body-sm">
          {quote.annual_discount_applied && discount > 0 ? (
            <span className="mr-1.5 text-ink-muted line-through">
              {formatMoney(listPrice, quote.currency)}
            </span>
          ) : null}
          {formatMoney(quote.base_amount_minor, quote.currency)}
        </Text>
      </div>
      <div className="mt-1.5 flex items-center justify-between gap-2">
        <Text as="span" variant="body-sm" tone="secondary">
          {quote.fee_label ?? 'Fee'} (10%)
        </Text>
        <Text as="span" variant="body-sm">
          {formatMoney(quote.fee_amount_minor, quote.currency)}
        </Text>
      </div>
      <div className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-3">
        <Text as="span" variant="body-sm" className="font-medium">
          Total charged today
        </Text>
        <Text as="span" variant="h4">
          {formatMoney(quote.total_amount_minor, quote.currency)}
        </Text>
      </div>
      {quote.fx_rate ? (
        <Text variant="caption" tone="secondary" className="mt-2 block">
          Converted at the live rate: 1 USD = {quote.fx_rate.toLocaleString()} NGN.
        </Text>
      ) : null}
    </div>
  );
}

/** The Operator billing screen: current plan, the plans, and the upgrade flow. */
export function Billing() {
  const operator = useAuthStore((state) => state.operator);
  const admin = isAdmin(operator);
  const { state, reload } = useAsyncData((signal) => getSubscription(signal), []);

  const [searchParams, setSearchParams] = useSearchParams();
  const returnStatus = searchParams.get('status');

  const [selectedTier, setSelectedTier] = useState<PurchasableTier>('pro');
  const [termMonths, setTermMonths] = useState<number>(1);
  const [provider, setProvider] = useState<PaymentProvider>('paystack');
  const [currency, setCurrency] = useState<PayCurrency>(currenciesFor('paystack')[0]!.currency);
  const availableCurrencies = currenciesFor(provider);
  const [promoCode, setPromoCode] = useState('');
  const [preview, setPreview] = useState<PromoPreview | null>(null);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [validating, setValidating] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [upgrading, setUpgrading] = useState(false);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [grantNotice, setGrantNotice] = useState<string | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);

  const data = state.status === 'ready' ? state.data : null;
  const configured = data?.configured ?? false;
  const subscription = data?.subscription ?? null;
  const currentTier = subscription?.status === 'active' ? subscription.tier : 'free';

  const clearPreview = () => {
    setPreview(null);
    setPromoError(null);
  };

  // The itemized total (subtotal, platform fee, and grand total) is priced fresh
  // whenever the plan or pay currency changes, so the Operator always sees the
  // exact amount before committing, including a live Naira conversion.
  useEffect(() => {
    if (!configured || admin) {
      return;
    }
    let cancelled = false;
    setQuoteError(null);
    quoteCheckout({ tier: selectedTier, currency, term_months: termMonths })
      .then((result) => {
        if (!cancelled) {
          setQuote(result);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setQuote(null);
          setQuoteError(
            error instanceof ApiError ? error.message : 'The price could not be loaded.',
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [configured, admin, selectedTier, currency, termMonths]);

  const dismissReturnNotice = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('status');
    next.delete('reference');
    setSearchParams(next, { replace: true });
  };

  const runValidate = async () => {
    const code = promoCode.trim();
    if (!code) {
      return;
    }
    setValidating(true);
    setPromoError(null);
    try {
      const result = await validatePromo({ code, tier: selectedTier, term_months: termMonths });
      setPreview(result);
    } catch (error) {
      setPreview(null);
      setPromoError(
        error instanceof ApiError ? error.message : 'That code could not be checked. Try again.',
      );
    } finally {
      setValidating(false);
    }
  };

  const runUpgrade = async () => {
    setUpgrading(true);
    setCheckoutError(null);
    setGrantNotice(null);
    try {
      const code = promoCode.trim();
      const result = await startCheckout({
        tier: selectedTier,
        provider,
        currency,
        promo_code: code || undefined,
        term_months: termMonths,
      });
      if (result.granted || !result.checkout_url) {
        // A free tier-grant promo activated the tier with no payment; there is no
        // provider page to visit, so refresh the subscription in place.
        setGrantNotice('Your plan was activated. Welcome to your new tier.');
        reload();
        return;
      }
      window.location.href = result.checkout_url;
    } catch (error) {
      setCheckoutError(
        error instanceof ApiError ? error.message : 'Checkout could not start. Try again.',
      );
    } finally {
      setUpgrading(false);
    }
  };

  const runCancel = async () => {
    setCheckoutError(null);
    try {
      await cancelSubscription();
      setConfirmingCancel(false);
      reload();
    } catch (error) {
      setCheckoutError(
        error instanceof ApiError ? error.message : 'The plan could not be canceled. Try again.',
      );
      setConfirmingCancel(false);
    }
  };

  return (
    <OperatorShell active="billing">
      <PageHeader
        title="Billing"
        description="Choose the plan that fits your fleet. SlideOps meters only what it provides, the servers you connect and the Projects you run, never the resources on your own servers."
      />

      {state.status === 'loading' ? <Loading label="Loading your plan" /> : null}
      {state.status === 'error' ? <ErrorNote error={state.error} /> : null}

      {data ? (
        <div className="flex flex-col gap-6">
          {returnStatus === 'success' ? (
            <div role="status" className="rounded-lg border border-border bg-subtle px-4 py-3">
              <Text variant="body-sm" className="font-medium text-success">
                Payment received. Your plan is being activated.
              </Text>
              <button
                type="button"
                onClick={dismissReturnNotice}
                className="mt-1 text-sm text-ink-muted underline transition-colors duration-fast ease-standard hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
              >
                Dismiss
              </button>
            </div>
          ) : null}
          {returnStatus === 'failed' ? (
            <div role="alert" className="rounded-lg border border-border bg-subtle px-4 py-3">
              <Text variant="body-sm" className="font-medium text-danger">
                That payment did not go through. Nothing was charged. You can try again below.
              </Text>
              <button
                type="button"
                onClick={dismissReturnNotice}
                className="mt-1 text-sm text-ink-muted underline transition-colors duration-fast ease-standard hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
              >
                Dismiss
              </button>
            </div>
          ) : null}
          {grantNotice ? (
            <div role="status" className="rounded-lg border border-border bg-subtle px-4 py-3">
              <Text variant="body-sm" className="font-medium text-success">
                {grantNotice}
              </Text>
            </div>
          ) : null}

          {subscription ? (
            <CurrentPlan subscription={subscription} onCancel={() => setConfirmingCancel(true)} />
          ) : (
            <Card>
              <Text variant="h4">You are on the Free plan</Text>
              <Text variant="body-sm" tone="secondary" className="mt-1">
                One server, one Project, and the full flow. Upgrade any time to run more.
              </Text>
            </Card>
          )}

          {admin ? (
            <Card>
              <div className="flex items-start gap-3">
                <Sparkles
                  width={18}
                  height={18}
                  className="mt-0.5 shrink-0 text-brand"
                  aria-hidden
                />
                <div>
                  <Text variant="h4">Administrators are unlimited</Text>
                  <Text variant="body-sm" tone="secondary" className="mt-1">
                    Your account carries the admin role, so it is not metered and never needs a
                    subscription. The plans below are shown for reference.
                  </Text>
                </div>
              </div>
            </Card>
          ) : null}

          {!configured ? (
            <Card>
              <Text variant="h4">Checkout is not available yet</Text>
              <Text variant="body-sm" tone="secondary" className="mt-1">
                No payment provider is configured on this platform, so plans are shown for reference
                only. Reach out to whoever runs this platform to enable subscriptions.
              </Text>
            </Card>
          ) : null}

          <div>
            <Text variant="h4" className="mb-3">
              Plans
            </Text>
            <div className="grid gap-4 sm:grid-cols-2">
              {PLANS.map((plan) => (
                <PlanCard
                  key={plan.tier}
                  plan={plan}
                  selected={configured && !admin && selectedTier === plan.tier}
                  current={currentTier === plan.tier}
                  disabled={!configured || admin}
                  onSelect={() => {
                    setSelectedTier(plan.tier);
                    clearPreview();
                  }}
                />
              ))}
            </div>
          </div>

          {configured && !admin ? (
            <Card>
              <Text variant="h4">Complete your upgrade</Text>
              <Text variant="body-sm" tone="secondary" className="mt-1">
                You are subscribing to the {tierLabel[selectedTier]} plan. Choose how you would like
                to pay.
              </Text>

              <fieldset className="mt-5">
                <legend className="text-sm font-medium text-ink">Billing cycle</legend>
                <div className="mt-3 grid gap-3 sm:grid-cols-4">
                  {TERM_OPTIONS.map((option) => {
                    const active = termMonths === option.months;
                    return (
                      <label
                        key={option.months}
                        className={cn(
                          'flex cursor-pointer flex-col items-center gap-1 rounded-lg border p-3 text-center transition-colors duration-fast ease-standard',
                          'focus-within:ring-2 focus-within:ring-focus',
                          active ? 'border-brand bg-brand-subtle' : 'border-border hover:bg-subtle',
                        )}
                      >
                        <input
                          type="radio"
                          name="billing-cycle"
                          value={option.months}
                          checked={active}
                          onChange={() => {
                            setTermMonths(option.months);
                            clearPreview();
                          }}
                          className="sr-only"
                        />
                        <Text as="span" variant="body-sm" className="font-medium">
                          {option.label}
                        </Text>
                        {option.months >= 12 ? (
                          <Text as="span" variant="caption" tone="secondary">
                            {option.months} months at once
                          </Text>
                        ) : null}
                      </label>
                    );
                  })}
                </div>
                <Text variant="caption" tone="secondary" className="mt-2 block">
                  Pay for more than one month at once: the price is simply the monthly price times
                  the months you choose. The first time you pay for a full year or more straight
                  through checkout, you get a one-time 2% discount, shown below.
                </Text>
              </fieldset>

              <fieldset className="mt-5">
                <legend className="text-sm font-medium text-ink">Payment provider</legend>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {PROVIDERS.map((entry) => {
                    const Icon = entry.icon;
                    const active = provider === entry.provider;
                    return (
                      <label
                        key={entry.provider}
                        className={cn(
                          'flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors duration-fast ease-standard',
                          'focus-within:ring-2 focus-within:ring-focus',
                          active ? 'border-brand bg-brand-subtle' : 'border-border hover:bg-subtle',
                        )}
                      >
                        <input
                          type="radio"
                          name="payment-provider"
                          value={entry.provider}
                          checked={active}
                          onChange={() => {
                            setProvider(entry.provider);
                            // The currency choice belongs to the gateway: switching
                            // gateways always lands on that gateway's own default.
                            setCurrency(currenciesFor(entry.provider)[0]!.currency);
                            clearPreview();
                          }}
                          className="sr-only"
                        />
                        <Icon
                          width={18}
                          height={18}
                          className={cn(
                            'mt-0.5 shrink-0',
                            active ? 'text-brand' : 'text-ink-muted',
                          )}
                          aria-hidden
                        />
                        <span>
                          <Text as="span" variant="body-sm" className="block font-medium">
                            {entry.name}
                          </Text>
                          <Text
                            as="span"
                            variant="body-sm"
                            tone="secondary"
                            className="mt-0.5 block"
                          >
                            {entry.helper}
                          </Text>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>

              {availableCurrencies.length > 1 ? (
                <fieldset className="mt-5">
                  <legend className="text-sm font-medium text-ink">Currency</legend>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    {availableCurrencies.map((entry) => {
                      const active = currency === entry.currency;
                      return (
                        <label
                          key={entry.currency}
                          className={cn(
                            'flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors duration-fast ease-standard',
                            'focus-within:ring-2 focus-within:ring-focus',
                            active ? 'border-brand bg-brand-subtle' : 'border-border hover:bg-subtle',
                          )}
                        >
                          <input
                            type="radio"
                            name="pay-currency"
                            value={entry.currency}
                            checked={active}
                            onChange={() => {
                              setCurrency(entry.currency);
                              clearPreview();
                            }}
                            className="sr-only"
                          />
                          <span>
                            <Text as="span" variant="body-sm" className="block font-medium">
                              {entry.name}
                            </Text>
                            <Text
                              as="span"
                              variant="body-sm"
                              tone="secondary"
                              className="mt-0.5 block"
                            >
                              {entry.helper}
                            </Text>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
              ) : (
                <Text variant="caption" tone="secondary" className="mt-5 block">
                  {PROVIDERS.find((p) => p.provider === provider)?.name} charges in{' '}
                  {availableCurrencies[0]!.name}. {availableCurrencies[0]!.helper}
                </Text>
              )}

              <div className="mt-5">
                {quote ? (
                  <PriceQuotePanel quote={quote} />
                ) : quoteError ? (
                  <p role="alert" className="text-sm text-danger">
                    {quoteError}
                  </p>
                ) : null}
              </div>

              <div className="mt-5">
                <label htmlFor="promo-code" className="text-sm font-medium text-ink">
                  Promo code
                </label>
                <div className="mt-2 flex flex-wrap items-start gap-3">
                  <input
                    id="promo-code"
                    value={promoCode}
                    placeholder="Optional"
                    onChange={(event) => {
                      setPromoCode(event.target.value);
                      clearPreview();
                    }}
                    aria-describedby={promoError ? 'promo-error' : undefined}
                    aria-invalid={promoError ? true : undefined}
                    className={cn(
                      'h-10 w-full max-w-xs rounded-md border bg-surface px-3 text-sm text-ink placeholder:text-ink-muted',
                      'transition-colors duration-fast ease-standard',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus',
                      promoError ? 'border-danger' : 'border-border',
                    )}
                  />
                  <Button
                    variant="secondary"
                    onClick={runValidate}
                    disabled={validating || promoCode.trim().length === 0}
                  >
                    {validating ? 'Checking' : 'Validate'}
                  </Button>
                </div>
                {promoError ? (
                  <p id="promo-error" className="mt-2 text-sm text-danger">
                    {promoError}
                  </p>
                ) : null}
              </div>

              {preview ? (
                <div className="mt-4">
                  <PromoPreviewPanel preview={preview} />
                  {!preview.free_grant ? (
                    <Text variant="caption" tone="secondary" className="mt-2 block">
                      The {quote?.fee_label ?? 'fee'} above still applies on top of this discounted
                      amount.
                    </Text>
                  ) : null}
                </div>
              ) : null}

              {checkoutError ? (
                <p role="alert" className="mt-4 text-sm text-danger">
                  {checkoutError}
                </p>
              ) : null}

              <div className="mt-6">
                <Button onClick={runUpgrade} disabled={upgrading}>
                  <CreditCard width={16} height={16} aria-hidden />
                  {upgrading ? 'Starting checkout' : `Upgrade to ${tierLabel[selectedTier]}`}
                </Button>
              </div>
            </Card>
          ) : null}
        </div>
      ) : null}

      {state.status === 'error' && !data ? (
        <div className="mt-6">
          <EmptyState
            icon={CreditCard}
            title="Billing is unavailable"
            description="We could not read your plan just now. Refresh to try again."
          />
        </div>
      ) : null}

      <ConfirmDialog
        open={confirmingCancel}
        title="Cancel your plan?"
        description="Your subscription ends and you return to the Free tier. Anything over the Free limits stays in place but you will not be able to add more until you are within them again."
        confirmLabel="Cancel plan"
        confirmVariant="danger"
        onConfirm={runCancel}
        onCancel={() => setConfirmingCancel(false)}
      />
    </OperatorShell>
  );
}
