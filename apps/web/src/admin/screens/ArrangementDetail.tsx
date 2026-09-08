import {
  ApiError,
  extendArrangementDeadline,
  getArrangement,
  listAdminTiers,
  listArrangementCurrencies,
  listArrangementEmails,
  listArrangementTimeline,
  previewArrangementEmail,
  restoreArrangementAccess,
  revokeArrangementAccess,
  sendArrangementEmail,
  updateArrangement,
  type ArrangementDetail as ArrangementDetailRecord,
  type ArrangementEmailPreview,
  type ArrangementWithOperator,
} from '@slideops/api-client';
import { Button, Card, Field, Text } from '@slideops/design-system';
import {
  ArrowLeft,
  CalendarClock,
  ExternalLink,
  Eye,
  History,
  Lock,
  Mail,
  Pencil,
  RotateCcw,
  ShieldAlert,
} from '@slideops/icons';
import { PageHeader } from '@slideops/ui';
import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  accessReading,
  accessStandingOf,
  arrangementEdit,
  conditionDescription,
  conditionLabel,
  factsOfDetail,
  isStaleEditorError,
  notOnThisServerYet,
  obligationOf,
  obligationReason,
  obligationText,
  obligationTone,
  paymentReading,
  readIfSupported,
  staleEditorMessage,
  type ArrangementEditDraft,
} from '../arrangements';
import { AdminShell } from '../components/AdminShell';
import { ArrangementStatusBadge, ReadingBadge } from '../components/Badges';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { ErrorNote, Loading } from '../components/Feedback';
import { CurrencySelect, QuoteBreakdown, TermMonthsField } from '../components/Pricing';
import { TBody, TD, TH, THead, TR, Table } from '../components/Table';
import { useArrangementQuote } from '../hooks/useArrangementQuote';
import { useAsyncData } from '../hooks/useAsyncData';
import { formatAmount } from '../subscribers';

/*
 * One arrangement, and everything an admin can do to it.
 *
 * The three readings stay three readings here as well. Access, payment, and
 * what is owed each get their own panel with its own reason, so nobody has to
 * work out which of the three a single status word was talking about.
 *
 * Every mutation carries the revision the screen was working from. When another
 * admin has changed the arrangement in the meantime the backend refuses, and
 * this says so plainly and offers a reload. It never retries and it never
 * resends the older values over the newer ones.
 */

const selectClass =
  'h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-ink transition-colors duration-fast ease-standard focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus';

const textareaClass =
  'w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-muted transition-colors duration-fast ease-standard focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus';

const toneTextClass: Record<'good' | 'warning' | 'bad' | 'neutral', string> = {
  good: 'text-success',
  warning: 'text-warning',
  bad: 'text-danger',
  neutral: 'text-ink-muted',
};

/** A moment, written out in full, with a name for its absence. */
function moment(value?: string): string {
  return value ? new Date(value).toLocaleString() : 'Not set';
}

/**
 * A UTC moment as `<input type="datetime-local">` wants it, in local time.
 * Going through the input's own format keeps what an admin sees in the form the
 * same as what they see everywhere else on the page.
 */
function toLocalInput(value?: string): string {
  if (!value) {
    return '';
  }
  const when = new Date(value);
  if (Number.isNaN(when.getTime())) {
    return '';
  }
  const pad = (part: number) => String(part).padStart(2, '0');
  return `${when.getFullYear()}-${pad(when.getMonth() + 1)}-${pad(when.getDate())}T${pad(when.getHours())}:${pad(when.getMinutes())}`;
}

/** One labelled fact. */
function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <Text variant="caption" tone="secondary" className="block">
        {label}
      </Text>
      <Text variant="body-sm" className="font-medium">
        {value}
      </Text>
    </div>
  );
}

/** One of the three readings, with the reason it reads that way. */
function ReadingPanel({
  title,
  badge,
  detail,
}: {
  title: string;
  badge: React.ReactNode;
  detail: string;
}) {
  return (
    <Card className="flex flex-col gap-2">
      <Text variant="caption" tone="secondary">
        {title}
      </Text>
      <div>{badge}</div>
      <Text variant="caption" tone="secondary">
        {detail}
      </Text>
    </Card>
  );
}

/** A section heading inside the detail. */
function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <Text variant="h4" className="mb-3 mt-8">
      {children}
    </Text>
  );
}

/** A quiet note for a section this deployment's backend does not answer yet. */
function NotYetOnServer({ what }: { what: string }) {
  return (
    <Card>
      <Text variant="body-sm" tone="secondary">
        {what} {notOnThisServerYet}
      </Text>
    </Card>
  );
}

/**
 * Build a detail from a list row.
 *
 * The lifecycle endpoints are being added to the backend now. Until a given
 * deployment has them, an admin who chose Manage still gets the arrangement they
 * asked for, read from the row they clicked, rather than an error page. What
 * cannot be done without the endpoint is disabled and says why.
 */
function detailFromRow(row: ArrangementWithOperator): ArrangementDetailRecord {
  return {
    arrangement: row,
    operator_id: row.operator_id,
    operator_email: row.operator_email,
    access_state: row.access_state ?? '',
    payment_state: row.payment_state ?? '',
    amount_minor: row.amount_minor,
    currency: row.currency,
    access_end: row.access_end,
    payment_deadline: row.payment_deadline,
    updated_at: row.updated_at ?? row.created_at,
    last_communication_at: row.last_communication_at,
  };
}

export function ArrangementDetail() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  // The row the list handed over, used only when the server has no detail
  // endpoint yet. It is never preferred over what the server says.
  const carried = (location.state as { arrangement?: ArrangementWithOperator } | null)
    ?.arrangement;

  const { state, reload } = useAsyncData(
    (signal) => readIfSupported(() => getArrangement(id, signal)),
    [id],
  );
  const timeline = useAsyncData(
    (signal) => readIfSupported(() => listArrangementTimeline(id, signal)),
    [id],
  );
  const emails = useAsyncData(
    (signal) => readIfSupported(() => listArrangementEmails(id, signal)),
    [id],
  );
  const tiers = useAsyncData((signal) => listAdminTiers(signal), []);
  // What this deployment can actually charge in. Read, never assumed: the tier
  // prices are all written in one currency and say nothing about what checkout
  // is able to convert to.
  const currencies = useAsyncData((signal) => listArrangementCurrencies(signal), []);

  const served = state.status === 'ready' ? state.data : null;
  const detail = useMemo(
    () => served ?? (carried && carried.id === id ? detailFromRow(carried) : null),
    [served, carried, id],
  );
  // Only what the server itself served can be corrected: an edit needs a
  // revision, and a row copied from the list is not one.
  const canMutate = served !== null;

  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [stale, setStale] = useState(false);

  /** Report a failed mutation, telling a stale editor apart from everything else. */
  const reportFailure = (error: unknown, fallback: string) => {
    if (isStaleEditorError(error)) {
      setStale(true);
      setActionError(null);
      return;
    }
    setActionError(error instanceof ApiError ? error.message : fallback);
  };

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<ArrangementEditDraft | null>(null);
  const [saving, setSaving] = useState(false);

  const baseline: ArrangementEditDraft | null = useMemo(
    () =>
      detail
        ? {
            tier: detail.arrangement.tier,
            amountMinor:
              detail.amount_minor === undefined || detail.amount_minor === null
                ? ''
                : String(detail.amount_minor),
            currency: detail.currency ?? '',
            paymentDeadline: toLocalInput(detail.payment_deadline),
            accessEnd: toLocalInput(detail.access_end),
            notes: detail.arrangement.notes ?? '',
          }
        : null,
    [detail],
  );

  // What the amount is worked out from. An arrangement does not record the term
  // it was agreed for, so nothing is assumed: until the admin states one there is
  // no question to price, and opening the editor proposes no change of its own.
  const [termMonths, setTermMonths] = useState('');
  const [quoteCurrency, setQuoteCurrency] = useState('');

  useEffect(() => {
    // A reload brings new values; the form follows them rather than holding a
    // draft written against a state that is no longer current.
    setDraft(baseline);
    setQuoteCurrency(baseline?.currency ?? '');
    setTermMonths('');
  }, [baseline]);

  const knownTiers = useMemo(
    () => (tiers.state.status === 'ready' ? tiers.state.data : []),
    [tiers.state],
  );
  const planOptions = useMemo(
    () =>
      Array.from(
        new Set([...knownTiers.map((tier) => tier.name), draft?.tier].filter(Boolean) as string[]),
      ),
    [knownTiers, draft?.tier],
  );
  const chargeableCurrencies = useMemo(
    () => (currencies.state.status === 'ready' ? currencies.state.data : []),
    [currencies.state],
  );
  const currencyOptions = useMemo(
    () =>
      Array.from(
        new Set(
          [...chargeableCurrencies, baseline?.currency].filter(Boolean) as string[],
        ),
      ),
    [chargeableCurrencies, baseline?.currency],
  );

  /*
   * The amount, worked out rather than typed.
   *
   * An admin used to do this arithmetic in their head and type the result, so
   * the CRM's figure and the real charge agreed only by luck. The plan, the
   * term and the currency are the inputs; the figure comes back from the same
   * pricing the customer's own checkout uses.
   */
  // A stated term is what turns the pricing inputs into a question. Without one
  // the payment side of the form is dormant and the other fields save as before.
  const pricingInPlay = termMonths.trim() !== '';
  const quote = useArrangementQuote({
    operatorId: detail?.operator_id ?? '',
    tier: draft?.tier ?? '',
    termMonths: Number(termMonths),
    currency: quoteCurrency,
    enabled: editing && detail !== null && pricingInPlay,
  });
  const quoted = quote.state.status === 'ready' ? quote.state.quote : null;

  // The obligation carries what was quoted, in the currency the backend said it
  // charged in. Nothing here is a number the admin wrote.
  const draftWithQuote: ArrangementEditDraft | null = draft
    ? quoted
      ? { ...draft, amountMinor: String(quoted.total_minor), currency: quoted.currency }
      : draft
    : null;
  const edit = baseline && draftWithQuote ? arrangementEdit(baseline, draftWithQuote) : null;

  const runSave = async () => {
    if (!detail || !edit || edit.changes.length === 0) {
      return;
    }
    setSaving(true);
    setActionError(null);
    setActionMessage(null);
    try {
      await updateArrangement(id, edit.patch, detail.updated_at);
      setActionMessage('Saved. The arrangement now reads as shown.');
      setEditing(false);
      reload();
      timeline.reload();
    } catch (error) {
      reportFailure(error, 'That change was not saved. Try again.');
    } finally {
      setSaving(false);
    }
  };

  const [extending, setExtending] = useState(false);
  const [extendValue, setExtendValue] = useState('');

  const runExtend = async () => {
    if (!extendValue) {
      return;
    }
    setActionError(null);
    setActionMessage(null);
    try {
      await extendArrangementDeadline(id, new Date(extendValue));
      setActionMessage('Deadline extended.');
      setExtending(false);
      setExtendValue('');
      reload();
      timeline.reload();
    } catch (error) {
      reportFailure(error, 'That extension did not go through. Try again.');
      setExtending(false);
    }
  };

  const [revoking, setRevoking] = useState(false);
  const [revokeReason, setRevokeReason] = useState('');

  const runRevoke = async () => {
    if (!detail || !revokeReason.trim()) {
      return;
    }
    setActionError(null);
    setActionMessage(null);
    try {
      await revokeArrangementAccess(id, revokeReason.trim(), detail.updated_at);
      setActionMessage('Access revoked. The customer no longer has this plan.');
      setRevoking(false);
      setRevokeReason('');
      reload();
      timeline.reload();
    } catch (error) {
      reportFailure(error, 'That revocation did not go through. Try again.');
      setRevoking(false);
    }
  };

  const [restoring, setRestoring] = useState(false);
  const [restoreReason, setRestoreReason] = useState('');

  const runRestore = async () => {
    setActionError(null);
    setActionMessage(null);
    try {
      await restoreArrangementAccess(id, restoreReason.trim() || undefined);
      setActionMessage('Access restored.');
      setRestoring(false);
      setRestoreReason('');
      reload();
      timeline.reload();
    } catch (error) {
      reportFailure(error, 'That restore did not go through. Try again.');
      setRestoring(false);
    }
  };

  const emailTypes = useMemo(() => detail?.email_types ?? [], [detail]);
  const [emailType, setEmailType] = useState('');
  const [preview, setPreview] = useState<ArrangementEmailPreview | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    // Follow the server's own list of message types; never invent one.
    setEmailType(emailTypes[0]?.type ?? '');
    setPreview(null);
  }, [emailTypes]);

  const runPreview = async () => {
    if (!emailType) {
      return;
    }
    setPreviewing(true);
    setActionError(null);
    setActionMessage(null);
    setPreview(null);
    try {
      setPreview(await previewArrangementEmail(id, emailType));
    } catch (error) {
      reportFailure(error, 'That message could not be rendered. Try again.');
    } finally {
      setPreviewing(false);
    }
  };

  const runSend = async () => {
    if (!emailType) {
      return;
    }
    setSending(true);
    setActionError(null);
    setActionMessage(null);
    try {
      const sent = await sendArrangementEmail(id, emailType);
      setActionMessage(`Message sent to ${sent.to}. Nothing else about this arrangement changed.`);
      setPreview(null);
      emails.reload();
      reload();
    } catch (error) {
      reportFailure(error, 'That message was not sent. Try again.');
    } finally {
      setSending(false);
    }
  };

  const facts = detail ? factsOfDetail(detail) : null;
  const access = facts ? accessReading(facts) : null;
  const payment = facts ? paymentReading(facts) : null;
  const obligation = facts ? obligationOf(facts) : null;
  const standing = facts ? accessStandingOf(facts) : null;
  const canRestore = standing === 'revoked' || standing === 'ended';
  const canRevoke = standing === 'granted';

  return (
    <AdminShell active="arrangements">
      <PageHeader
        title={detail ? detail.operator_email || detail.operator_id : 'Arrangement'}
        description={
          detail
            ? `${conditionLabel[detail.arrangement.condition]}. ${conditionDescription[detail.arrangement.condition]}`
            : 'One payment arrangement and its whole lifecycle.'
        }
        actions={
          <Button variant="ghost" size="sm" onClick={() => navigate('/admin/arrangements')}>
            <ArrowLeft width={14} height={14} aria-hidden />
            All arrangements
          </Button>
        }
      />

      {state.status === 'loading' ? <Loading label="Loading arrangement" /> : null}
      {state.status === 'error' ? <ErrorNote error={state.error} /> : null}

      {state.status === 'ready' && !detail ? (
        <Card>
          <Text variant="body-sm">
            This arrangement cannot be opened on this server build. {notOnThisServerYet}
          </Text>
          <Text variant="body-sm" tone="secondary" className="mt-2">
            Creating arrangements, cancelling one, and extending a deadline are unaffected and
            still work from the Subscriber page.
          </Text>
        </Card>
      ) : null}

      {detail && facts && access && payment && obligation ? (
        <>
          {stale ? (
            <div
              role="alert"
              className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-warning bg-subtle px-4 py-3"
            >
              <Text variant="body-sm">{staleEditorMessage}</Text>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setStale(false);
                  reload();
                  timeline.reload();
                  emails.reload();
                }}
              >
                <RotateCcw width={14} height={14} aria-hidden />
                Reload it
              </Button>
            </div>
          ) : null}

          {actionError ? (
            <div
              role="alert"
              className="mb-4 rounded-md border border-danger bg-subtle px-4 py-3 text-sm text-ink"
            >
              {actionError}
            </div>
          ) : null}
          {actionMessage ? (
            <div
              role="status"
              className="mb-4 rounded-md border border-border bg-subtle px-4 py-3 text-sm text-ink"
            >
              {actionMessage}
            </div>
          ) : null}

          {!canMutate ? (
            <Card className="mb-4">
              <Text variant="body-sm" tone="secondary">
                Read from the list, because this server build has no arrangement detail endpoint
                yet. Editing, revoking, restoring, and messaging need it. {notOnThisServerYet}
              </Text>
            </Card>
          ) : null}

          {/* The three readings, kept apart. An arrangement can be live, unpaid,
              and owing a named sum on a named date all at once, and each of the
              three is a different thing to act on. */}
          <div className="grid gap-4 sm:grid-cols-3">
            <ReadingPanel
              title="Access"
              badge={<ReadingBadge reading={access} />}
              detail={access.detail}
            />
            <ReadingPanel
              title="Payment"
              badge={<ReadingBadge reading={payment} />}
              detail={payment.detail}
            />
            <ReadingPanel
              title="Owed"
              badge={
                <Text
                  as="span"
                  variant="body"
                  className={`font-medium ${toneTextClass[obligationTone(obligation, facts)]}`}
                >
                  {obligationText(obligation)}
                </Text>
              }
              detail={
                obligationReason(obligation) ??
                'What this arrangement obliges the customer to pay, in the currency it was agreed in.'
              }
            />
          </div>

          <Card className="mt-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Fact label="Customer" value={detail.operator_email || detail.operator_id} />
              <Fact label="Plan" value={detail.arrangement.tier} />
              <Fact label="Arrangement" value={conditionLabel[detail.arrangement.condition]} />
              <div>
                <Text variant="caption" tone="secondary" className="block">
                  Arrangement status
                </Text>
                <ArrangementStatusBadge status={detail.arrangement.status} />
              </div>
              <Fact
                label="Access period"
                value={`${moment(detail.access_start ?? detail.arrangement.created_at)} to ${moment(detail.access_end)}`}
              />
              <Fact
                label="Payment amount"
                value={
                  obligation.kind === 'free'
                    ? 'No charge'
                    : detail.amount_minor === undefined ||
                        detail.amount_minor === null ||
                        detail.amount_minor === 0
                      ? 'Not recorded'
                      : formatAmount(detail.amount_minor, detail.currency)
                }
              />
              <Fact
                label="Currency"
                value={
                  obligation.kind === 'free'
                    ? 'Not applicable'
                    : detail.currency || 'Not recorded'
                }
              />
              <Fact label="Payment deadline" value={moment(detail.payment_deadline)} />
            </div>

            {detail.arrangement.notes ? (
              <div className="mt-4 rounded-md border border-dashed border-warning bg-subtle px-4 py-3">
                <div className="flex items-center gap-2">
                  <Lock width={14} height={14} className="text-warning" aria-hidden />
                  <Text variant="caption" className="font-semibold uppercase tracking-wide">
                    Internal note, never shown to the customer
                  </Text>
                </div>
                <Text variant="body-sm" className="mt-1.5 whitespace-pre-wrap">
                  {detail.arrangement.notes}
                </Text>
              </div>
            ) : null}

            <div className="mt-5 flex flex-wrap gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={!canMutate}
                onClick={() => {
                  setDraft(baseline);
                  setEditing((open) => !open);
                }}
              >
                <Pencil width={14} height={14} aria-hidden />
                Edit
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setExtendValue(toLocalInput(detail.payment_deadline));
                  setExtending(true);
                }}
              >
                <CalendarClock width={14} height={14} aria-hidden />
                Extend
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={!canMutate}
                onClick={() => {
                  document.getElementById('send-a-message')?.scrollIntoView({ block: 'start' });
                }}
              >
                <Mail width={14} height={14} aria-hidden />
                Send Email
              </Button>
              {canRevoke ? (
                <Button
                  variant="danger"
                  size="sm"
                  disabled={!canMutate}
                  onClick={() => {
                    setRevokeReason('');
                    setRevoking(true);
                  }}
                >
                  <ShieldAlert width={14} height={14} aria-hidden />
                  Revoke
                </Button>
              ) : null}
              {canRestore ? (
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={!canMutate}
                  onClick={() => {
                    setRestoreReason('');
                    setRestoring(true);
                  }}
                >
                  <RotateCcw width={14} height={14} aria-hidden />
                  Restore
                </Button>
              ) : null}
            </div>
          </Card>

          {editing && draft && edit ? (
            <Card className="mt-4">
              <Text variant="h4">Edit this arrangement</Text>
              <Text variant="body-sm" tone="secondary" className="mt-1">
                Access, payment, and timing are three separate questions and are asked separately.
                Only what you change is sent.
              </Text>

              <fieldset className="mt-5 rounded-md border border-border p-4">
                <legend className="px-1.5 text-sm font-semibold text-ink">Access</legend>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-2">
                    <label htmlFor="edit-tier" className="text-sm font-medium text-ink">
                      Plan
                    </label>
                    <select
                      id="edit-tier"
                      className={selectClass}
                      value={draft.tier}
                      onChange={(event) =>
                        setDraft({ ...draft, tier: event.target.value })
                      }
                    >
                      {/* Plans come from the platform's own tier definitions, so
                          nothing here is a name typed into the frontend. The
                          arrangement's current plan is always among them, even
                          if the tier list has moved on since it was agreed. */}
                      {planOptions.map((name) => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <Field
                    label="Access ends"
                    type="datetime-local"
                    hint="Leave empty for access with no end date."
                    value={draft.accessEnd}
                    onChange={(event) => setDraft({ ...draft, accessEnd: event.target.value })}
                  />
                </div>
              </fieldset>

              <fieldset className="mt-4 rounded-md border border-border p-4">
                <legend className="px-1.5 text-sm font-semibold text-ink">Payment</legend>
                <Text variant="body-sm" tone="secondary">
                  What the customer is expected to pay follows from the plan above, the term, and
                  the currency, priced by the same pricing their own checkout uses. It is not typed
                  here: a figure typed here and the figure really charged agree only by luck.
                </Text>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <TermMonthsField
                    label="Term"
                    hint="How many months this covers. Set it to work out what is owed."
                    value={termMonths}
                    onChange={setTermMonths}
                  />
                  <CurrencySelect
                    id="edit-currency"
                    label="Currency"
                    value={quoteCurrency}
                    onChange={setQuoteCurrency}
                    options={currencyOptions}
                    allowNative
                    hint="What this deployment is able to charge in, as the server named them."
                  />
                </div>
                <div className="mt-4">
                  <QuoteBreakdown
                    state={quote.state}
                    availableCurrencies={chargeableCurrencies}
                  />
                </div>
              </fieldset>

              <fieldset className="mt-4 rounded-md border border-border p-4">
                <legend className="px-1.5 text-sm font-semibold text-ink">Timing</legend>
                <Field
                  label="Payment deadline"
                  type="datetime-local"
                  hint="When the payment is expected by."
                  value={draft.paymentDeadline}
                  onChange={(event) => setDraft({ ...draft, paymentDeadline: event.target.value })}
                />
              </fieldset>

              <div className="mt-4 flex flex-col gap-2">
                <label htmlFor="edit-notes" className="text-sm font-medium text-ink">
                  Internal notes
                </label>
                <textarea
                  id="edit-notes"
                  rows={3}
                  className={textareaClass}
                  value={draft.notes}
                  onChange={(event) => setDraft({ ...draft, notes: event.target.value })}
                  placeholder="Context for whoever picks this up next"
                />
                <Text variant="caption" tone="secondary">
                  Internal only. The customer never sees this.
                </Text>
              </div>

              <div className="mt-5 rounded-md border border-border bg-subtle px-4 py-3">
                <Text variant="body-sm" className="font-medium">
                  {edit.changes.length === 0
                    ? 'Nothing has changed yet'
                    : `About to change ${edit.changes.length === 1 ? '1 field' : `${edit.changes.length} fields`}`}
                </Text>
                {edit.changes.length > 0 ? (
                  <ul className="mt-2 flex flex-col gap-1">
                    {edit.changes.map((change) => (
                      <li key={change.field}>
                        <Text as="span" variant="body-sm" tone="secondary">
                          {change.label}: {change.from} becomes{' '}
                        </Text>
                        <Text as="span" variant="body-sm" className="font-medium">
                          {change.to}
                        </Text>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  variant="primary"
                  size="sm"
                  disabled={
                    saving ||
                    edit.changes.length === 0 ||
                    !canMutate ||
                    // Never a figure that was never computed. When the quote did
                    // not come back there is nothing honest to save.
                    (pricingInPlay && quote.state.status !== 'ready')
                  }
                  onClick={runSave}
                >
                  {saving ? 'Saving' : 'Save changes'}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={saving}
                  onClick={() => {
                    setDraft(baseline);
                    setEditing(false);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </Card>
          ) : null}

          {detail.arrangement.payment_reference ? (
            <>
              <SectionTitle>Transaction</SectionTitle>
              <Table label="The payment this arrangement is tied to">
                <THead>
                  <TH>Reference</TH>
                  <TH>Amount</TH>
                  <TH className="text-right">Open</TH>
                </THead>
                <TBody>
                  <TR>
                    <TD className="font-medium">{detail.arrangement.payment_reference}</TD>
                    <TD>
                      {detail.amount_minor
                        ? formatAmount(detail.amount_minor, detail.currency)
                        : 'Not recorded'}
                    </TD>
                    <TD className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          navigate(
                            `/admin/subscribers/${detail.operator_id}/payments/${detail.arrangement.payment_reference}`,
                          )
                        }
                      >
                        <ExternalLink width={14} height={14} aria-hidden />
                        Payment
                      </Button>
                    </TD>
                  </TR>
                </TBody>
              </Table>
            </>
          ) : null}

          <SectionTitle>
            <span id="send-a-message">Send a message</span>
          </SectionTitle>
          <Card>
            <Text variant="body-sm" tone="secondary">
              Sending writes to the customer and does nothing else. No plan moves, no access
              changes, no payment is recorded. Read it first, then send it.
            </Text>
            {emailTypes.length === 0 ? (
              <Text variant="body-sm" tone="secondary" className="mt-3">
                This server build has not published the message types for an arrangement, so there
                is nothing to choose from yet. {notOnThisServerYet}
              </Text>
            ) : (
              <>
                <div className="mt-4 flex flex-wrap items-end gap-3">
                  <div className="flex flex-col gap-2 sm:min-w-[16rem]">
                    <label htmlFor="email-type" className="text-sm font-medium text-ink">
                      Message type
                    </label>
                    <select
                      id="email-type"
                      className={selectClass}
                      value={emailType}
                      onChange={(event) => {
                        setEmailType(event.target.value);
                        setPreview(null);
                      }}
                    >
                      {emailTypes.map((type) => (
                        <option key={type.type} value={type.type}>
                          {type.label || type.type}
                        </option>
                      ))}
                    </select>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={runPreview}
                    disabled={previewing || !emailType}
                  >
                    <Eye width={14} height={14} aria-hidden />
                    {previewing ? 'Rendering' : 'Preview'}
                  </Button>
                </div>
                {emailTypes.find((type) => type.type === emailType)?.description ? (
                  <Text variant="caption" tone="secondary" className="mt-2 block">
                    {emailTypes.find((type) => type.type === emailType)?.description}
                  </Text>
                ) : null}

                {preview ? (
                  <div className="mt-4 rounded-md border border-border">
                    <div className="border-b border-border bg-subtle px-4 py-3">
                      <Text variant="caption" tone="secondary" className="block">
                        Preview only. Nothing has been sent.
                      </Text>
                      <Text variant="body-sm" className="mt-1">
                        To: <span className="font-medium">{preview.to}</span>
                      </Text>
                      <Text variant="body-sm">
                        Subject: <span className="font-medium">{preview.subject}</span>
                      </Text>
                    </div>
                    <pre className="max-h-80 overflow-auto whitespace-pre-wrap px-4 py-3 text-sm text-ink">
                      {preview.body}
                    </pre>
                    <div className="border-t border-border px-4 py-3">
                      <Button variant="primary" size="sm" onClick={runSend} disabled={sending}>
                        <Mail width={14} height={14} aria-hidden />
                        {sending ? 'Sending' : 'Send this message'}
                      </Button>
                    </div>
                  </div>
                ) : null}
              </>
            )}
          </Card>

          <SectionTitle>Communication history</SectionTitle>
          {emails.state.status === 'loading' ? <Loading label="Loading messages" /> : null}
          {emails.state.status === 'error' ? <ErrorNote error={emails.state.error} /> : null}
          {emails.state.status === 'ready' && emails.state.data === null ? (
            <NotYetOnServer what="The communication history is not readable here." />
          ) : null}
          {emails.state.status === 'ready' && emails.state.data?.length === 0 ? (
            <Card>
              <Text variant="body-sm" tone="secondary">
                The customer has not been written to about this arrangement.
              </Text>
            </Card>
          ) : null}
          {emails.state.status === 'ready' && (emails.state.data?.length ?? 0) > 0 ? (
            <Table label="Messages sent about this arrangement">
              <THead>
                <TH>Type</TH>
                <TH>Sent</TH>
                <TH>Recipient</TH>
                <TH>Outcome</TH>
                <TH>Sent by</TH>
              </THead>
              <TBody>
                {(emails.state.data ?? []).map((email) => (
                  <TR key={email.id}>
                    <TD className="font-medium">{email.type}</TD>
                    <TD className="whitespace-nowrap text-ink-muted">{moment(email.sent_at)}</TD>
                    <TD>{email.to}</TD>
                    <TD>
                      <span
                        className={
                          email.outcome === 'sent' ? 'font-medium text-success' : 'font-medium text-danger'
                        }
                      >
                        {email.outcome}
                      </span>
                      {email.detail ? (
                        <Text variant="caption" tone="secondary" className="block">
                          {email.detail}
                        </Text>
                      ) : null}
                    </TD>
                    <TD className="text-ink-muted">{email.sent_by_email || 'Automatic'}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          ) : null}

          <SectionTitle>Activity</SectionTitle>
          {timeline.state.status === 'loading' ? <Loading label="Loading activity" /> : null}
          {timeline.state.status === 'error' ? <ErrorNote error={timeline.state.error} /> : null}
          {timeline.state.status === 'ready' && timeline.state.data === null ? (
            <NotYetOnServer what="The activity timeline is not readable here." />
          ) : null}
          {timeline.state.status === 'ready' && timeline.state.data?.length === 0 ? (
            <Card>
              <Text variant="body-sm" tone="secondary">
                Nothing has happened to this arrangement since it was created.
              </Text>
            </Card>
          ) : null}
          {timeline.state.status === 'ready' && (timeline.state.data?.length ?? 0) > 0 ? (
            <Card>
              <ul className="flex flex-col gap-3">
                {(timeline.state.data ?? []).map((entry) => (
                  <li key={entry.id} className="flex items-start gap-3">
                    <History width={15} height={15} className="mt-0.5 text-ink-muted" aria-hidden />
                    <div className="min-w-0">
                      <Text variant="body-sm" className="font-medium">
                        {entry.action}
                      </Text>
                      <Text variant="caption" tone="secondary" className="block">
                        {moment(entry.created_at)}
                        {entry.actor_email ? ` by ${entry.actor_email}` : ''}
                      </Text>
                      {entry.detail ? (
                        <Text variant="body-sm" tone="secondary" className="mt-0.5 block">
                          {entry.detail}
                        </Text>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          <ConfirmDialog
            open={extending}
            title="Move the payment deadline"
            description={
              <div className="flex flex-col gap-3">
                <p>
                  The customer gets longer to pay. Access is not changed by this, and no message is
                  sent by it either.
                </p>
                <Field
                  label="New deadline"
                  type="datetime-local"
                  value={extendValue}
                  onChange={(event) => setExtendValue(event.target.value)}
                />
              </div>
            }
            confirmLabel="Move the deadline"
            confirmDisabled={!extendValue}
            onConfirm={runExtend}
            onCancel={() => setExtending(false)}
          />

          <ConfirmDialog
            open={revoking}
            title="Revoke this access?"
            description={
              <div className="flex flex-col gap-3">
                <p>
                  This takes <strong className="text-ink">{detail.arrangement.tier}</strong> away
                  from <strong className="text-ink">{detail.operator_email || detail.operator_id}</strong>{' '}
                  right now.
                </p>
                <ul className="flex list-disc flex-col gap-1 pl-5">
                  <li>Access today: {access.label}. {access.detail}</li>
                  <li>Payment today: {payment.label}. {payment.detail}</li>
                  <li>Outstanding: {obligationText(obligation)}</li>
                  <li>
                    Access period:{' '}
                    {moment(detail.access_start ?? detail.arrangement.created_at)} to{' '}
                    {moment(detail.access_end)}
                  </li>
                </ul>
                <p>This is written to the audit trail with the reason you give.</p>
                <Field
                  label="Reason"
                  hint="Why this access is being taken back. Required, and recorded."
                  value={revokeReason}
                  onChange={(event) => setRevokeReason(event.target.value)}
                  placeholder="Payment never arrived after two reminders"
                />
              </div>
            }
            confirmLabel="Revoke access"
            confirmVariant="danger"
            confirmDisabled={revokeReason.trim() === ''}
            onConfirm={runRevoke}
            onCancel={() => {
              setRevoking(false);
              setRevokeReason('');
            }}
          />

          <ConfirmDialog
            open={restoring}
            title="Restore this access?"
            description={
              <div className="flex flex-col gap-3">
                <p>
                  This puts <strong className="text-ink">{detail.arrangement.tier}</strong> back for{' '}
                  <strong className="text-ink">
                    {detail.operator_email || detail.operator_id}
                  </strong>
                  . What is owed does not change: {obligationText(obligation)}.
                </p>
                <Field
                  label="Reason"
                  hint="Optional, and recorded with the restore."
                  value={restoreReason}
                  onChange={(event) => setRestoreReason(event.target.value)}
                  placeholder="Payment confirmed by the bank"
                />
              </div>
            }
            confirmLabel="Restore access"
            onConfirm={runRestore}
            onCancel={() => {
              setRestoring(false);
              setRestoreReason('');
            }}
          />
        </>
      ) : null}
    </AdminShell>
  );
}
