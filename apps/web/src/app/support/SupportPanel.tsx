import {
  ApiError,
  ask,
  confirmAction,
  quickActions,
  supportPresets,
  type SupportAction,
  type SupportContext,
  type SupportPreset,
  type SupportPresetCategory,
  type SupportQuickAction,
  type SupportResponse,
} from '@slideops/api-client';
import { Button, Text } from '@slideops/design-system';
import { ArrowRight, ChevronDown, Sparkles } from '@slideops/icons';
import { Drawer } from '@slideops/ui';
import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { useNavigate } from 'react-router-dom';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { ErrorNote } from '../components/Feedback';
import {
  conversationReducer,
  initialConversationState,
  toHistory,
  type ConversationMessage,
} from './support-conversation';

/*
 * Support Intelligence's panel. It behaves like the platform's own operator
 * guide, not a general chatbot: every answer is composed by the backend from
 * real state, every action it offers runs through the same permission and
 * execution paths as the rest of the app, and a destructive or
 * confirm-required action always goes through the existing ConfirmDialog --
 * never a silent call.
 */

export interface SupportPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  context: SupportContext;
  /** When the panel opens for this reason, send this as the first message
   * automatically -- the "Why did this fail?" contextual entry points use
   * this rather than making the Operator retype the obvious question. */
  initialMessage?: string | null;
}

/** An action offer and a quick action are the same shape once accepted: an id
 * to run, a label, and whether it needs confirmation. This normalizes both so
 * one runner handles them. */
interface Runnable {
  id: string;
  label: string;
  destructive: boolean;
  confirmRequired: boolean;
  params: Record<string, unknown>;
}

function toRunnable(action: SupportAction): Runnable {
  return {
    id: action.id,
    label: action.label,
    destructive: action.destructive,
    confirmRequired: action.confirm_required,
    params: action.params,
  };
}

function quickToRunnable(action: SupportQuickAction): Runnable {
  return {
    id: action.id,
    label: action.label,
    destructive: action.destructive,
    confirmRequired: action.confirm_required,
    params: {},
  };
}

export function SupportPanel({ open, onOpenChange, context, initialMessage }: SupportPanelProps) {
  const navigate = useNavigate();
  const [state, dispatch] = useReducer(conversationReducer, initialConversationState);
  const [input, setInput] = useState('');
  const [chips, setChips] = useState<SupportQuickAction[]>([]);
  // null means "not fetched yet" -- distinct from a resolved but genuinely
  // empty list, so a failed or empty fetch reads as "nothing to browse" and
  // not as a permanent loading spinner.
  const [presetCategories, setPresetCategories] = useState<SupportPresetCategory[] | null>(null);
  const [pending, setPending] = useState<Runnable | null>(null);
  const [actionError, setActionError] = useState<ApiError | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const sentInitialFor = useRef<string | null>(null);

  // presetIntent, when set, is a preset question's own Intent: the backend
  // answers from it directly and skips free text classification, so a preset
  // click carries none of the misclassification risk typing does. Omitted
  // for anything the Operator actually typed.
  const send = useCallback(
    (text: string, presetIntent?: string) => {
      const trimmed = text.trim();
      if (trimmed === '') {
        return;
      }
      const id = crypto.randomUUID();
      const historySoFar = toHistory(state.messages);
      dispatch({ type: 'send', id, text: trimmed });
      const controller = new AbortController();
      ask(trimmed, historySoFar, context, controller.signal, presetIntent)
        .then((response: SupportResponse) => dispatch({ type: 'receive', response }))
        .catch((error: unknown) => {
          if (controller.signal.aborted) {
            return;
          }
          dispatch({
            type: 'error',
            error: error instanceof ApiError ? error : new ApiError(0, 'unknown_error', 'Something went wrong.'),
          });
        });
    },
    [context, state.messages],
  );

  // Move focus in on open, restore it on close, and reset the conversation so
  // a stale answer from a different page never lingers into this one.
  useEffect(() => {
    if (!open) {
      dispatch({ type: 'reset' });
      setChips([]);
      setPresetCategories(null);
      setInput('');
      setPending(null);
      setActionError(null);
      sentInitialFor.current = null;
      return;
    }
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    inputRef.current?.focus();
    return () => {
      previouslyFocused.current?.focus?.();
    };
  }, [open]);

  // Contextual entry points open the panel with a question already in mind.
  // Send it once per open, keyed by the message itself so re-opening with the
  // same prompt does not silently no-op.
  useEffect(() => {
    if (!open || !initialMessage || sentInitialFor.current === initialMessage) {
      return;
    }
    sentInitialFor.current = initialMessage;
    send(initialMessage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialMessage]);

  // Quick actions are tailored to whatever the Operator is currently looking
  // at, so they are refreshed whenever the panel opens or the context changes
  // while it is open.
  useEffect(() => {
    if (!open) {
      return;
    }
    const controller = new AbortController();
    quickActions(context.resource_type, context.resource_id, controller.signal)
      .then(setChips)
      .catch(() => setChips([]));
    return () => controller.abort();
  }, [open, context.resource_type, context.resource_id]);

  // The "Browse topics" preset catalog does not depend on page context, so it
  // is fetched once per open, not re-fetched as the Operator navigates
  // underneath an already open panel.
  useEffect(() => {
    if (!open) {
      return;
    }
    const controller = new AbortController();
    supportPresets(controller.signal)
      .then(setPresetCategories)
      .catch(() => setPresetCategories([]));
    return () => controller.abort();
  }, [open]);

  const runNow = useCallback(
    (runnable: Runnable) => {
      setActionError(null);
      confirmAction(runnable.id, runnable.params, context)
        .then((result) => {
          dispatch({
            type: 'receive',
            response: {
              text: result.message,
              confidence: 'high',
              cards: [],
              actions: [],
              navigation: null,
              follow_up: null,
            },
          });
        })
        .catch((error: unknown) => {
          setActionError(
            error instanceof ApiError ? error : new ApiError(0, 'unknown_error', 'The action failed to start.'),
          );
        });
    },
    [context],
  );

  const runAction = useCallback(
    (runnable: Runnable) => {
      if (runnable.destructive || runnable.confirmRequired) {
        setPending(runnable);
        return;
      }
      runNow(runnable);
    },
    [runNow],
  );

  // Stable across re-renders so Drawer's own focus-on-open effect, which
  // depends on this callback's identity, does not re-fire -- and steal focus
  // back from the input -- on every keystroke.
  const closeDrawer = useCallback(() => onOpenChange(false), [onOpenChange]);

  if (!open) {
    return null;
  }

  return (
    <>
      <Drawer open={open} onClose={closeDrawer} title="Support">
        <div className="flex h-full flex-col">
          <div
            role="log"
            aria-live="polite"
            aria-relevant="additions"
            className="flex-1 space-y-4 overflow-y-auto"
          >
            {state.messages.length === 0 ? (
              <EmptySupportState categories={presetCategories} onSelect={(option) => send(option.message, option.intent)} />
            ) : (
              state.messages.map((message) => (
                <ConversationBubble
                  key={message.id}
                  message={message}
                  onNavigate={(path) => {
                    onOpenChange(false);
                    navigate(path);
                  }}
                  onAction={runAction}
                  onFollowUp={(label, value) => send(label, value || undefined)}
                />
              ))
            )}
            {state.status === 'loading' ? (
              <Text variant="body-sm" tone="secondary">
                Thinking…
              </Text>
            ) : null}
            {state.status === 'error' && state.error ? <ErrorNote error={state.error} /> : null}
          </div>

          {chips.length > 0 && state.messages.length === 0 ? (
            <div className="flex flex-wrap gap-2 border-t border-border pt-3">
              {chips.map((chip) => (
                <Button
                  key={chip.id}
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => runAction(quickToRunnable(chip))}
                >
                  {chip.label}
                </Button>
              ))}
            </div>
          ) : null}

          {actionError ? <ErrorNote error={actionError} /> : null}

          <form
            className="mt-3 flex items-center gap-2 border-t border-border pt-3"
            onSubmit={(event) => {
              event.preventDefault();
              send(input);
              setInput('');
            }}
          >
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Ask Support anything about SlideOps…"
              aria-label="Ask Support"
              className="h-10 flex-1 rounded-md border border-border bg-app px-3 text-sm text-ink placeholder:text-ink-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            />
            <Button type="submit" size="sm" disabled={state.status === 'loading' || input.trim() === ''}>
              <ArrowRight width={16} height={16} aria-hidden />
              <span className="sr-only">Send</span>
            </Button>
          </form>
        </div>
      </Drawer>

      <ConfirmDialog
        open={pending !== null}
        title={pending?.label ?? ''}
        description={
          pending?.destructive
            ? `This will ${pending.label.toLowerCase()}. This action is destructive and cannot be undone. Do you want to continue?`
            : `This will ${pending?.label.toLowerCase() ?? ''}. Do you want to continue?`
        }
        confirmLabel={pending?.label ?? 'Continue'}
        confirmVariant={pending?.destructive ? 'danger' : 'primary'}
        onCancel={() => setPending(null)}
        onConfirm={async () => {
          if (!pending) {
            return;
          }
          runNow(pending);
          setPending(null);
        }}
      />
    </>
  );
}

/** The panel's resting state, before the Operator has asked anything: a
 * browsable catalog of ready made questions, each answerable with certainty,
 * rather than an empty box inviting a guess at what to type. Free text is
 * still available below for anything not covered here. */
function EmptySupportState({
  categories,
  onSelect,
}: {
  // null is "not fetched yet"; [] is "fetched, nothing to browse" (a failed
  // fetch degrades to this too) -- each gets its own honest message rather
  // than sharing one that would misdescribe the other.
  categories: SupportPresetCategory[] | null;
  onSelect: (option: SupportPreset) => void;
}) {
  if (categories === null) {
    return (
      <div className="flex flex-col items-center gap-2 py-8 text-center">
        <Sparkles width={20} height={20} className="text-ink-muted" aria-hidden />
        <Text variant="body-sm" tone="secondary">
          Loading what Support can help with…
        </Text>
      </div>
    );
  }
  if (categories.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-8 text-center">
        <Sparkles width={20} height={20} className="text-ink-muted" aria-hidden />
        <Text variant="body-sm" tone="secondary">
          Type your question below and Support will do its best to help.
        </Text>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <Text variant="body-sm" tone="secondary">
        Browse a topic below, or type your own question.
      </Text>
      <PresetBrowser categories={categories} onSelect={onSelect} />
    </div>
  );
}

/** A simple, single-open accordion of preset categories. Not a search box or
 * a tree: the catalog is small enough per category that a plain expandable
 * list is the whole interaction, nothing more to build here. */
function PresetBrowser({
  categories,
  onSelect,
}: {
  categories: SupportPresetCategory[];
  onSelect: (option: SupportPreset) => void;
}) {
  const [openLabel, setOpenLabel] = useState<string | null>(categories[0]?.label ?? null);
  return (
    <div className="space-y-1.5">
      {categories.map((category) => {
        const expanded = openLabel === category.label;
        return (
          <div key={category.label} className="rounded-md border border-border">
            <button
              type="button"
              aria-expanded={expanded}
              onClick={() => setOpenLabel(expanded ? null : category.label)}
              className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm font-medium text-ink"
            >
              {category.label}
              <ChevronDown
                width={16}
                height={16}
                aria-hidden
                className={expanded ? 'rotate-180 text-ink-muted transition-transform' : 'text-ink-muted transition-transform'}
              />
            </button>
            {expanded ? (
              <div className="flex flex-col gap-0.5 border-t border-border p-1.5">
                {category.options.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => onSelect(option)}
                    className="rounded-md px-2 py-1.5 text-left text-sm text-ink-muted transition-colors duration-fast ease-standard hover:bg-subtle hover:text-ink"
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function ConversationBubble({
  message,
  onNavigate,
  onAction,
  onFollowUp,
}: {
  message: ConversationMessage;
  onNavigate: (path: string) => void;
  onAction: (runnable: Runnable) => void;
  onFollowUp: (label: string, value: string) => void;
}) {
  const isOperator = message.role === 'operator';
  return (
    <div className={isOperator ? 'flex justify-end' : 'flex justify-start'}>
      <div
        className={
          isOperator
            ? 'max-w-[85%] rounded-lg bg-brand px-3 py-2 text-brand-fg'
            : 'max-w-[85%] rounded-lg border border-border bg-subtle px-3 py-2'
        }
      >
        {isOperator ? (
          <p className="text-sm leading-relaxed text-brand-fg">{message.text}</p>
        ) : (
          <div className="so-prose max-w-none text-sm">
            <ReactMarkdown>{message.text}</ReactMarkdown>
          </div>
        )}

        {message.cards && message.cards.length > 0 ? (
          <div className="mt-2 space-y-1.5">
            {message.cards.map((card) => (
              <div
                key={`${card.kind}:${card.id}`}
                className="rounded-md border border-border bg-surface px-2.5 py-1.5"
              >
                <Text variant="body-sm" className="font-medium">
                  {card.title}
                </Text>
                <Text variant="caption" tone="secondary">
                  {card.subtitle}
                </Text>
              </div>
            ))}
          </div>
        ) : null}

        {message.actions && message.actions.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {message.actions.map((action) => (
              <Button
                key={action.id}
                type="button"
                size="sm"
                variant={action.destructive ? 'danger' : 'secondary'}
                onClick={() => onAction(toRunnable(action))}
              >
                {action.label}
              </Button>
            ))}
          </div>
        ) : null}

        {message.navigation ? (
          <div className="mt-2">
            <Button
              type="button"
              size="sm"
              variant="primary"
              onClick={() => onNavigate(message.navigation!.path)}
            >
              {message.navigation.label}
            </Button>
          </div>
        ) : null}

        {message.followUp ? (
          <div className="mt-2">
            <Text variant="body-sm" tone="secondary">
              {message.followUp.question}
            </Text>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {message.followUp.options.map((option) => (
                <Button
                  key={option.value}
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => onFollowUp(option.label, option.value)}
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
