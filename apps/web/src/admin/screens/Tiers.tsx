import { ApiError, listAdminTiers, updateAdminTier, type AdminTier } from '@slideops/api-client';
import { Button, Card, Field, Text } from '@slideops/design-system';
import { Check, Layers } from '@slideops/icons';
import { PageHeader } from '@slideops/ui';
import { useState } from 'react';
import { ErrorNote, Loading } from '../components/Feedback';
import { AdminShell } from '../components/AdminShell';
import { useAsyncData } from '../hooks/useAsyncData';

/*
 * The Admin tier editor. It lists the four tiers and lets an admin edit each
 * one's quotas, feature flags, and price without a redeploy, since the backend
 * applies a saved tier live. Counts use -1 to mean Unlimited on the wire; the UI
 * hides that sentinel behind a per-field Unlimited toggle so no one types a magic
 * number. Each tier saves on its own, reflects the returned values, and shows a
 * 400 as a friendly validation message. Colors are semantic tokens only, so the
 * surface reads correctly in both themes.
 */

/** A count or window field's working shape: a positive value or the Unlimited flag. */
interface CountDraft {
  unlimited: boolean;
  value: string;
}

/** One tier's editable draft. Numbers are held as strings so inputs stay controlled. */
interface TierDraft {
  nodes: CountDraft;
  projects: CountDraft;
  seats: CountDraft;
  history_days: CountDraft;
  automations: boolean;
  advanced_monitoring: boolean;
  audit_trail: boolean;
  amount_minor: string;
  currency: string;
  purchasable: boolean;
}

/** Turn a wire count (-1 for Unlimited) into its editable draft. */
function countFromWire(value: number): CountDraft {
  return value < 0 ? { unlimited: true, value: '' } : { unlimited: false, value: String(value) };
}

/** Build the full editable draft from a tier definition. */
function draftFromTier(tier: AdminTier): TierDraft {
  return {
    nodes: countFromWire(tier.nodes),
    projects: countFromWire(tier.projects),
    seats: countFromWire(tier.seats),
    history_days: countFromWire(tier.history_days),
    automations: tier.automations,
    advanced_monitoring: tier.advanced_monitoring,
    audit_trail: tier.audit_trail,
    amount_minor: String(tier.amount_minor),
    currency: tier.currency,
    purchasable: tier.purchasable,
  };
}

/** Reduce a count draft to its wire number, or NaN when a non-Unlimited value is blank or invalid. */
function countToWire(draft: CountDraft): number {
  if (draft.unlimited) {
    return -1;
  }
  const trimmed = draft.value.trim();
  if (trimmed === '') {
    return Number.NaN;
  }
  const parsed = Number.parseInt(trimmed, 10);
  return Number.isNaN(parsed) ? Number.NaN : parsed;
}

/** Reduce the whole draft to the wire payload. Values may be NaN when a field is empty. */
function draftToWire(draft: TierDraft): Omit<AdminTier, 'name'> {
  const amount = Number.parseInt(draft.amount_minor.trim(), 10);
  return {
    nodes: countToWire(draft.nodes),
    projects: countToWire(draft.projects),
    seats: countToWire(draft.seats),
    history_days: countToWire(draft.history_days),
    automations: draft.automations,
    advanced_monitoring: draft.advanced_monitoring,
    audit_trail: draft.audit_trail,
    amount_minor: Number.isNaN(amount) ? Number.NaN : amount,
    currency: draft.currency.trim(),
    purchasable: draft.purchasable,
  };
}

/** The wire payload for a saved tier, used as the dirty-check baseline. */
function tierToWire(tier: AdminTier): Omit<AdminTier, 'name'> {
  const { name: _name, ...rest } = tier;
  return rest;
}

/** True when two payloads carry the same values, so Save can be disabled when nothing changed. */
function samePayload(a: Omit<AdminTier, 'name'>, b: Omit<AdminTier, 'name'>): boolean {
  return (
    a.nodes === b.nodes &&
    a.projects === b.projects &&
    a.seats === b.seats &&
    a.history_days === b.history_days &&
    a.automations === b.automations &&
    a.advanced_monitoring === b.advanced_monitoring &&
    a.audit_trail === b.audit_trail &&
    a.amount_minor === b.amount_minor &&
    a.currency === b.currency &&
    a.purchasable === b.purchasable
  );
}

/** Format a minor-unit amount into its major unit for the price helper. */
function majorUnit(amountMinor: number, currency: string): string {
  if (Number.isNaN(amountMinor)) {
    return 'Enter a whole number of minor units.';
  }
  const major = amountMinor / 100;
  const code = currency.trim().toUpperCase();
  if (code.length === 3) {
    try {
      return new Intl.NumberFormat(undefined, { style: 'currency', currency: code }).format(major);
    } catch {
      // An unknown or malformed code falls through to the plain format below.
    }
  }
  const plain = major.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return code ? `${code} ${plain}` : plain;
}

/** Give a tier its display name from its key. */
function tierLabel(name: string): string {
  return name.charAt(0).toUpperCase() + name.slice(1);
}

const checkboxClass =
  'h-4 w-4 rounded border-border text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus';

const numberInputClass =
  'h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-ink placeholder:text-ink-muted transition-colors duration-fast ease-standard focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:opacity-50';

/** A count or window field with its Unlimited toggle, grouped for assistive tech. */
function CountControl({
  idBase,
  label,
  hint,
  draft,
  onChange,
}: {
  idBase: string;
  label: string;
  hint: string;
  draft: CountDraft;
  onChange: (next: CountDraft) => void;
}) {
  const numberId = `${idBase}-value`;
  const hintId = `${idBase}-hint`;
  return (
    <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
      <legend className="mb-2 text-sm font-medium text-ink">{label}</legend>
      <label className="flex items-center gap-2 text-sm text-ink">
        <input
          type="checkbox"
          className={checkboxClass}
          checked={draft.unlimited}
          onChange={(event) => onChange({ ...draft, unlimited: event.target.checked })}
        />
        Unlimited
      </label>
      {draft.unlimited ? (
        <p className="text-sm text-ink-muted">No ceiling on this tier.</p>
      ) : (
        <>
          <input
            id={numberId}
            type="number"
            min={0}
            step={1}
            className={numberInputClass}
            aria-label={label}
            aria-describedby={hintId}
            value={draft.value}
            onChange={(event) => onChange({ ...draft, value: event.target.value })}
          />
          <p id={hintId} className="text-sm text-ink-muted">
            {hint}
          </p>
        </>
      )}
    </fieldset>
  );
}

/** A labelled feature toggle. */
function FeatureToggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm text-ink">
      <input
        type="checkbox"
        className={checkboxClass}
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      {label}
    </label>
  );
}

/** One tier's editor: quotas, feature flags, price, and its own Save. */
function TierCard({ tier }: { tier: AdminTier }) {
  // The last saved definition is the dirty-check baseline. It advances only when
  // a save succeeds, so the list load can stay a plain read.
  const [baseline, setBaseline] = useState<AdminTier>(tier);
  const [draft, setDraft] = useState<TierDraft>(() => draftFromTier(tier));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const patch = (next: Partial<TierDraft>) => {
    setDraft((current) => ({ ...current, ...next }));
    setSaved(false);
    setError(null);
  };

  const payload = draftToWire(draft);
  const dirty = !samePayload(payload, tierToWire(baseline));
  const priceId = `tier-${tier.name}-amount`;
  const statusId = `tier-${tier.name}-status`;

  const save = async () => {
    setError(null);
    // Guard the empty and negative cases locally so the message is immediate; the
    // backend remains the authority and its 400 is surfaced the same way.
    const counts = [payload.nodes, payload.projects, payload.seats, payload.history_days];
    if (counts.some((value) => Number.isNaN(value))) {
      setError('Give every limit a whole number, or mark it Unlimited.');
      return;
    }
    // -1 is the Unlimited sentinel countToWire produces when the checkbox is
    // ticked, not a negative limit: only below it is actually out of range.
    if (counts.some((value) => value < -1)) {
      setError('Limits cannot be negative. Mark a field Unlimited instead.');
      return;
    }
    if (Number.isNaN(payload.amount_minor)) {
      setError('Give the price a whole number of minor units, or 0 when it is not for sale.');
      return;
    }
    if (payload.amount_minor < 0) {
      setError('The price cannot be negative.');
      return;
    }
    setSaving(true);
    try {
      const updated = await updateAdminTier(tier.name, payload);
      setBaseline(updated);
      setDraft(draftFromTier(updated));
      setSaved(true);
    } catch (saveError) {
      setError(
        saveError instanceof ApiError
          ? saveError.message
          : 'The tier could not be saved. Check the fields and try again.',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <div className="mb-4 flex items-center gap-2">
        <Layers width={18} height={18} className="text-brand" aria-hidden />
        <Text variant="h4">{tierLabel(tier.name)}</Text>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <CountControl
          idBase={`tier-${tier.name}-nodes`}
          label="Nodes"
          hint="Servers this tier may register."
          draft={draft.nodes}
          onChange={(next) => patch({ nodes: next })}
        />
        <CountControl
          idBase={`tier-${tier.name}-projects`}
          label="Projects"
          hint="Projects this tier may run."
          draft={draft.projects}
          onChange={(next) => patch({ projects: next })}
        />
        <CountControl
          idBase={`tier-${tier.name}-seats`}
          label="Seats"
          hint="Operators this tier may seat."
          draft={draft.seats}
          onChange={(next) => patch({ seats: next })}
        />
        <CountControl
          idBase={`tier-${tier.name}-history`}
          label="History days"
          hint="Days of History this tier retains."
          draft={draft.history_days}
          onChange={(next) => patch({ history_days: next })}
        />
      </div>

      <div className="mt-6">
        <Text variant="body-sm" className="mb-3 font-medium">
          Features
        </Text>
        <div className="flex flex-wrap gap-x-6 gap-y-3">
          <FeatureToggle
            label="Automations"
            checked={draft.automations}
            onChange={(next) => patch({ automations: next })}
          />
          <FeatureToggle
            label="Advanced monitoring"
            checked={draft.advanced_monitoring}
            onChange={(next) => patch({ advanced_monitoring: next })}
          />
          <FeatureToggle
            label="Audit trail"
            checked={draft.audit_trail}
            onChange={(next) => patch({ audit_trail: next })}
          />
        </div>
      </div>

      <div className="mt-6">
        <Text variant="body-sm" className="mb-3 font-medium">
          Price
        </Text>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            id={priceId}
            label="Amount (minor units)"
            type="number"
            min={0}
            step={1}
            value={draft.amount_minor}
            onChange={(event) => patch({ amount_minor: event.target.value })}
            hint={`= ${majorUnit(payload.amount_minor, draft.currency)}`}
          />
          <Field
            label="Currency"
            value={draft.currency}
            onChange={(event) => patch({ currency: event.target.value })}
            placeholder="NGN"
            hint="Short code, so NGN or USD."
          />
        </div>
        <div className="mt-4">
          <FeatureToggle
            label="Purchasable"
            checked={draft.purchasable}
            onChange={(next) => patch({ purchasable: next })}
          />
          <p className="mt-2 text-sm text-ink-muted">
            Free and enterprise tiers are not purchasable and carry a zero price.
          </p>
        </div>
      </div>

      {error ? (
        <p id={statusId} role="alert" className="mt-4 text-sm text-danger">
          {error}
        </p>
      ) : null}

      <div className="mt-6 flex items-center gap-3">
        <Button onClick={save} disabled={saving || !dirty}>
          <Check width={16} height={16} aria-hidden />
          {saving ? 'Saving' : 'Save changes'}
        </Button>
        {saved && !dirty ? (
          <span role="status" className="inline-flex items-center gap-1.5 text-sm text-success">
            <Check width={15} height={15} aria-hidden />
            Saved. In effect now.
          </span>
        ) : null}
      </div>
    </Card>
  );
}

/** The Admin tier editor: one self-saving card per tier. */
export function Tiers() {
  const { state } = useAsyncData((signal) => listAdminTiers(signal), []);
  const tiers = state.status === 'ready' ? state.data : [];

  return (
    <AdminShell active="tiers">
      <PageHeader
        title="Tiers"
        description="Edit each tier's limits, features, and price. Changes take effect immediately, with no redeploy, and are written to the audit trail."
      />

      {state.status === 'loading' ? <Loading label="Loading tiers" /> : null}
      {state.status === 'error' ? <ErrorNote error={state.error} /> : null}

      {state.status === 'ready' ? (
        <div className="flex flex-col gap-6">
          {tiers.map((tier) => (
            <TierCard key={tier.name} tier={tier} />
          ))}
        </div>
      ) : null}
    </AdminShell>
  );
}
