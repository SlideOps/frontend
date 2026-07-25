import {
  ApiError,
  createPromoCode,
  deletePromoCode,
  listPromoCodes,
  setPromoCodeEnabled,
  type CreatePromoCodeInput,
  type PromoCode,
  type PromoEffect,
  type PromoEffectKind,
} from '@slideops/api-client';
import { Button, Card, Field, Text } from '@slideops/design-system';
import { Plus, Tag, TicketPercent, ToggleLeft, ToggleRight, Trash2 } from '@slideops/icons';
import { PageHeader } from '@slideops/ui';
import { useState } from 'react';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { ErrorNote, Loading } from '../components/Feedback';
import { TBody, TD, TH, THead, TR, Table } from '../components/Table';
import { AdminShell } from '../components/AdminShell';
import { useAsyncData } from '../hooks/useAsyncData';

/*
 * The Admin promo-code manager. It lists every code with its window, caps, and
 * effects, offers an enable or disable toggle and a confirmed delete, and carries
 * a create form with a small effect editor. Every mutation is audited on the
 * backend, so this screen just calls the endpoints and reflects the result.
 * Colors are semantic tokens only, so the surface reads correctly in both themes.
 */

const selectClass =
  'h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-ink transition-colors duration-fast ease-standard focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus';

const kindLabel: Record<PromoEffectKind, string> = {
  percent_discount: 'Percent discount',
  fixed_discount: 'Fixed discount',
  duration_conditional: 'Duration deal',
  value_add: 'Value add',
  tier_grant: 'Tier grant',
};

const EFFECT_KINDS: PromoEffectKind[] = [
  'percent_discount',
  'fixed_discount',
  'duration_conditional',
  'value_add',
  'tier_grant',
];

const GRANT_TIERS = ['starter', 'pro', 'enterprise'];

/** A one-line, plain-language summary of an effect, for the list. */
function describeEffect(effect: PromoEffect): string {
  switch (effect.kind) {
    case 'percent_discount':
      return `${effect.percent ?? 0}% off`;
    case 'fixed_discount':
      return `${((effect.amount_minor ?? 0) / 100).toLocaleString()} off`;
    case 'duration_conditional':
      return `Buy ${effect.term_months ?? 0} months, ${effect.percent ?? 0}% off`;
    case 'value_add': {
      const parts: string[] = [];
      if (effect.bonus_nodes) {
        parts.push(`+${effect.bonus_nodes} servers`);
      }
      if (effect.bonus_projects) {
        parts.push(`+${effect.bonus_projects} Projects`);
      }
      if (effect.bonus_seats) {
        parts.push(`+${effect.bonus_seats} seats`);
      }
      return parts.length > 0 ? parts.join(', ') : 'Value add';
    }
    case 'tier_grant':
      return `Free ${effect.tier ?? 'tier'}${effect.free_days ? ` for ${effect.free_days} days` : ''}`;
    default:
      return effect.kind;
  }
}

/** Render the optional validity window in plain language. */
function windowText(code: PromoCode): string {
  const start = code.starts_at ? new Date(code.starts_at).toLocaleDateString() : null;
  const end = code.ends_at ? new Date(code.ends_at).toLocaleDateString() : null;
  if (!start && !end) {
    return 'Always';
  }
  return `${start ?? 'Any time'} to ${end ?? 'no end'}`;
}

/** The effect editor's working shape: every field a string so inputs stay controlled. */
interface EffectDraft {
  kind: PromoEffectKind;
  percent: string;
  amount_minor: string;
  term_months: string;
  bonus_nodes: string;
  bonus_projects: string;
  bonus_seats: string;
  tier: string;
  free_days: string;
}

function emptyEffect(): EffectDraft {
  return {
    kind: 'percent_discount',
    percent: '',
    amount_minor: '',
    term_months: '',
    bonus_nodes: '',
    bonus_projects: '',
    bonus_seats: '',
    tier: 'pro',
    free_days: '',
  };
}

/** Turn an integer-shaped string into a number, or undefined when blank. */
function toInt(value: string): number | undefined {
  const trimmed = value.trim();
  if (trimmed === '') {
    return undefined;
  }
  const parsed = Number.parseInt(trimmed, 10);
  return Number.isNaN(parsed) ? undefined : parsed;
}

/** Reduce an effect draft to the wire shape, keeping only the fields its kind reads. */
function draftToEffect(draft: EffectDraft): PromoEffect {
  switch (draft.kind) {
    case 'percent_discount':
      return { kind: draft.kind, percent: toInt(draft.percent) };
    case 'fixed_discount':
      return { kind: draft.kind, amount_minor: toInt(draft.amount_minor) };
    case 'duration_conditional':
      return {
        kind: draft.kind,
        term_months: toInt(draft.term_months),
        percent: toInt(draft.percent),
      };
    case 'value_add':
      return {
        kind: draft.kind,
        bonus_nodes: toInt(draft.bonus_nodes),
        bonus_projects: toInt(draft.bonus_projects),
        bonus_seats: toInt(draft.bonus_seats),
      };
    case 'tier_grant':
      return { kind: draft.kind, tier: draft.tier, free_days: toInt(draft.free_days) };
    default:
      return { kind: draft.kind };
  }
}

/** The fields shown for one effect, driven by its kind. */
function EffectFields({
  draft,
  onChange,
}: {
  draft: EffectDraft;
  onChange: (patch: Partial<EffectDraft>) => void;
}) {
  switch (draft.kind) {
    case 'percent_discount':
      return (
        <Field
          label="Percent off"
          type="number"
          min={1}
          max={100}
          value={draft.percent}
          onChange={(event) => onChange({ percent: event.target.value })}
          hint="Between 1 and 100."
        />
      );
    case 'fixed_discount':
      return (
        <Field
          label="Amount off"
          type="number"
          min={1}
          value={draft.amount_minor}
          onChange={(event) => onChange({ amount_minor: event.target.value })}
          hint="In the smallest currency unit, so 500 is 5.00."
        />
      );
    case 'duration_conditional':
      return (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Term in months"
            type="number"
            min={1}
            value={draft.term_months}
            onChange={(event) => onChange({ term_months: event.target.value })}
            hint="The term the deal is conditioned on."
          />
          <Field
            label="Percent off"
            type="number"
            min={1}
            max={100}
            value={draft.percent}
            onChange={(event) => onChange({ percent: event.target.value })}
            hint="Applied when that term is bought."
          />
        </div>
      );
    case 'value_add':
      return (
        <div className="grid gap-4 sm:grid-cols-3">
          <Field
            label="Extra servers"
            type="number"
            min={0}
            value={draft.bonus_nodes}
            onChange={(event) => onChange({ bonus_nodes: event.target.value })}
          />
          <Field
            label="Extra Projects"
            type="number"
            min={0}
            value={draft.bonus_projects}
            onChange={(event) => onChange({ bonus_projects: event.target.value })}
          />
          <Field
            label="Extra seats"
            type="number"
            min={0}
            value={draft.bonus_seats}
            onChange={(event) => onChange({ bonus_seats: event.target.value })}
          />
        </div>
      );
    case 'tier_grant':
      return (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-ink" htmlFor="grant-tier">
              Tier to grant
            </label>
            <select
              id="grant-tier"
              className={selectClass}
              value={draft.tier}
              onChange={(event) => onChange({ tier: event.target.value })}
            >
              {GRANT_TIERS.map((tier) => (
                <option key={tier} value={tier}>
                  {tier.charAt(0).toUpperCase() + tier.slice(1)}
                </option>
              ))}
            </select>
          </div>
          <Field
            label="Free days"
            type="number"
            min={1}
            value={draft.free_days}
            onChange={(event) => onChange({ free_days: event.target.value })}
            hint="How long the grant lasts, with no charge."
          />
        </div>
      );
    default:
      return null;
  }
}

/** The create form, held apart so the list stays readable. */
function CreateForm({ onCreated }: { onCreated: () => void }) {
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [maxRedemptions, setMaxRedemptions] = useState('0');
  const [maxPerOperator, setMaxPerOperator] = useState('1');
  const [effects, setEffects] = useState<EffectDraft[]>([emptyEffect()]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const patchEffect = (index: number, patch: Partial<EffectDraft>) => {
    setEffects((current) =>
      current.map((effect, i) => (i === index ? { ...effect, ...patch } : effect)),
    );
  };

  const addEffect = () => setEffects((current) => [...current, emptyEffect()]);
  const removeEffect = (index: number) =>
    setEffects((current) => current.filter((_, i) => i !== index));

  const submit = async () => {
    setError(null);
    if (code.trim() === '') {
      setError('Give the code a name Operators will enter at checkout.');
      return;
    }
    if (effects.length === 0) {
      setError('Add at least one effect for the code to do something.');
      return;
    }
    const input: CreatePromoCodeInput = {
      code: code.trim(),
      description: description.trim() || undefined,
      starts_at: startsAt ? new Date(startsAt).toISOString() : undefined,
      ends_at: endsAt ? new Date(endsAt).toISOString() : undefined,
      max_redemptions: toInt(maxRedemptions) ?? 0,
      max_per_operator: toInt(maxPerOperator) ?? 1,
      effects: effects.map(draftToEffect),
    };
    setSubmitting(true);
    try {
      await createPromoCode(input);
      setCode('');
      setDescription('');
      setStartsAt('');
      setEndsAt('');
      setMaxRedemptions('0');
      setMaxPerOperator('1');
      setEffects([emptyEffect()]);
      onCreated();
    } catch (submitError) {
      setError(
        submitError instanceof ApiError
          ? submitError.message
          : 'The code could not be created. Check the fields and try again.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card>
      <div className="mb-4 flex items-center gap-2">
        <TicketPercent width={18} height={18} className="text-brand" aria-hidden />
        <Text variant="h4">Create a promo code</Text>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Code"
          value={code}
          onChange={(event) => setCode(event.target.value)}
          placeholder="WELCOME"
          hint="Matched case-insensitively at checkout."
        />
        <Field
          label="Description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Launch offer"
        />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field
          label="Starts"
          type="datetime-local"
          value={startsAt}
          onChange={(event) => setStartsAt(event.target.value)}
          hint="Optional. Leave blank to start now."
        />
        <Field
          label="Ends"
          type="datetime-local"
          value={endsAt}
          onChange={(event) => setEndsAt(event.target.value)}
          hint="Optional. Leave blank for no end."
        />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field
          label="Max redemptions"
          type="number"
          min={0}
          value={maxRedemptions}
          onChange={(event) => setMaxRedemptions(event.target.value)}
          hint="0 means unlimited."
        />
        <Field
          label="Max per Operator"
          type="number"
          min={1}
          value={maxPerOperator}
          onChange={(event) => setMaxPerOperator(event.target.value)}
          hint="How many times one Operator may redeem it."
        />
      </div>

      <div className="mt-6">
        <div className="mb-3 flex items-center justify-between gap-2">
          <Text variant="h4">Effects</Text>
          <Button variant="secondary" size="sm" onClick={addEffect}>
            <Plus width={15} height={15} aria-hidden />
            Add effect
          </Button>
        </div>
        <div className="flex flex-col gap-4">
          {effects.map((effect, index) => (
            <div key={index} className="rounded-lg border border-border bg-app p-4">
              <div className="flex items-end gap-3">
                <div className="flex flex-1 flex-col gap-2">
                  <label className="text-sm font-medium text-ink" htmlFor={`effect-kind-${index}`}>
                    Kind
                  </label>
                  <select
                    id={`effect-kind-${index}`}
                    className={selectClass}
                    value={effect.kind}
                    onChange={(event) =>
                      patchEffect(index, { kind: event.target.value as PromoEffectKind })
                    }
                  >
                    {EFFECT_KINDS.map((kind) => (
                      <option key={kind} value={kind}>
                        {kindLabel[kind]}
                      </option>
                    ))}
                  </select>
                </div>
                {effects.length > 1 ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeEffect(index)}
                    aria-label="Remove this effect"
                  >
                    <Trash2 width={15} height={15} aria-hidden />
                  </Button>
                ) : null}
              </div>
              <div className="mt-4">
                <EffectFields draft={effect} onChange={(patch) => patchEffect(index, patch)} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {error ? (
        <p role="alert" className="mt-4 text-sm text-danger">
          {error}
        </p>
      ) : null}

      <div className="mt-6">
        <Button onClick={submit} disabled={submitting}>
          <Plus width={16} height={16} aria-hidden />
          {submitting ? 'Creating' : 'Create code'}
        </Button>
      </div>
    </Card>
  );
}

/** The Admin promo-code manager: the list, the toggles, delete, and the create form. */
export function PromoCodes() {
  const { state, reload } = useAsyncData((signal) => listPromoCodes(signal), []);
  const [pendingDelete, setPendingDelete] = useState<PromoCode | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const codes = state.status === 'ready' ? state.data : [];

  const runToggle = async (code: PromoCode) => {
    setActionError(null);
    try {
      await setPromoCodeEnabled(code.id, !code.enabled);
      reload();
    } catch (error) {
      setActionError(
        error instanceof ApiError ? error.message : 'That action did not go through. Try again.',
      );
    }
  };

  const runDelete = async () => {
    if (!pendingDelete) {
      return;
    }
    setActionError(null);
    try {
      await deletePromoCode(pendingDelete.id);
      setPendingDelete(null);
      reload();
    } catch (error) {
      setActionError(
        error instanceof ApiError ? error.message : 'That action did not go through. Try again.',
      );
      setPendingDelete(null);
    }
  };

  return (
    <AdminShell active="promo-codes">
      <PageHeader
        title="Promo codes"
        description="Create and govern the codes Operators redeem at checkout. Every change here is written to the audit trail."
      />

      {actionError ? (
        <p role="alert" className="mb-4 text-sm text-danger">
          {actionError}
        </p>
      ) : null}

      {state.status === 'loading' ? <Loading label="Loading promo codes" /> : null}
      {state.status === 'error' ? <ErrorNote error={state.error} /> : null}

      {state.status === 'ready' ? (
        <div className="flex flex-col gap-8">
          {codes.length > 0 ? (
            <Table label="Promo codes">
              <THead>
                <TH>Code</TH>
                <TH>Effects</TH>
                <TH>Window</TH>
                <TH>Caps</TH>
                <TH>Redemptions</TH>
                <TH>State</TH>
                <TH className="text-right">Actions</TH>
              </THead>
              <TBody>
                {codes.map((code) => (
                  <TR key={code.id}>
                    <TD className="font-medium">
                      <div className="flex items-center gap-2">
                        <Tag width={15} height={15} className="text-ink-muted" aria-hidden />
                        {code.code}
                      </div>
                      {code.description ? (
                        <span className="mt-0.5 block text-xs text-ink-muted">
                          {code.description}
                        </span>
                      ) : null}
                    </TD>
                    <TD>
                      <div className="flex flex-col gap-0.5">
                        {code.effects.map((effect, index) => (
                          <span key={index} className="text-ink-muted">
                            {describeEffect(effect)}
                          </span>
                        ))}
                      </div>
                    </TD>
                    <TD className="text-ink-muted">{windowText(code)}</TD>
                    <TD className="text-ink-muted">
                      {code.max_redemptions === 0 ? 'Unlimited' : code.max_redemptions} total,{' '}
                      {code.max_per_operator} per Operator
                    </TD>
                    <TD className="text-ink-muted">
                      {code.redemption_count === undefined ? '0' : code.redemption_count}
                    </TD>
                    <TD>
                      <span
                        className={
                          'inline-flex items-center gap-1.5 rounded-pill bg-subtle px-2.5 py-0.5 text-xs font-medium ' +
                          (code.enabled ? 'text-success' : 'text-ink-muted')
                        }
                      >
                        {code.enabled ? 'Enabled' : 'Disabled'}
                      </span>
                    </TD>
                    <TD>
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="secondary" size="sm" onClick={() => runToggle(code)}>
                          {code.enabled ? (
                            <ToggleRight width={15} height={15} aria-hidden />
                          ) : (
                            <ToggleLeft width={15} height={15} aria-hidden />
                          )}
                          {code.enabled ? 'Disable' : 'Enable'}
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => setPendingDelete(code)}
                          aria-label={`Delete ${code.code}`}
                        >
                          <Trash2 width={15} height={15} aria-hidden />
                        </Button>
                      </div>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          ) : (
            <Card>
              <Text variant="body-sm" tone="secondary">
                No promo codes yet. Create the first one below.
              </Text>
            </Card>
          )}

          <CreateForm onCreated={reload} />
        </div>
      ) : null}

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete this promo code?"
        description={
          pendingDelete
            ? `Deleting ${pendingDelete.code} removes it and all of its redemptions. This cannot be undone and is written to the audit trail.`
            : ''
        }
        confirmLabel="Delete code"
        confirmVariant="danger"
        onConfirm={runDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </AdminShell>
  );
}
