import { apiRequest } from './http';

/*
 * Support Intelligence: a deterministic, product-native assistant. It never
 * calls an external LLM; every answer is composed from real platform state,
 * and every action it offers runs through the same permission and execution
 * paths every other resource in this client does. This module is the wire
 * contract only -- the reasoning lives entirely on the backend.
 */

/** One turn in the conversation, sent back with each request so the server
 * stays stateless: it re-derives what was asked and answered rather than
 * holding a session. */
export interface SupportTurn {
  role: 'operator' | 'support';
  text: string;
}

/** What the Operator is currently looking at, assembled from the route. A
 * page with no matching resource sends nulls rather than guessing. */
export interface SupportContext {
  route: string;
  resource_type: string | null;
  resource_id: string | null;
}

/** A compact reference to a real resource the answer is grounded in. */
export interface SupportCard {
  kind: string;
  id: string;
  title: string;
  subtitle: string;
}

/** An action Support can offer. A destructive or confirm_required action must
 * be confirmed before `confirmAction` is called; `params` are opaque and are
 * sent back unchanged on confirm. */
export interface SupportAction {
  id: string;
  label: string;
  destructive: boolean;
  confirm_required: boolean;
  params: Record<string, unknown>;
}

/** A single next step the assistant can navigate the Operator to directly. */
export interface SupportNavigation {
  path: string;
  label: string;
}

/** A clarifying question Support asks when it cannot resolve a required slot
 * from context or the utterance -- selecting an option continues the same
 * conversation rather than starting a new one. */
export interface SupportFollowUpOption {
  label: string;
  value: string;
}

export interface SupportFollowUp {
  question: string;
  options: SupportFollowUpOption[];
}

/** The full composed answer to one question. */
export interface SupportResponse {
  text: string;
  confidence: 'high' | 'medium' | 'low';
  cards: SupportCard[];
  actions: SupportAction[];
  navigation: SupportNavigation | null;
  follow_up: SupportFollowUp | null;
}

/** The result of confirming and running a prepared action. Mirrors every
 * other mutating endpoint: it reports that the operation started, never that
 * it finished -- completion is observed later over the event stream. */
export interface SupportActionResult {
  status: 'started';
  message: string;
  resource_id: string | null;
}

/** A lightweight suggestion chip, tailored to the current context. */
export interface SupportQuickAction {
  id: string;
  label: string;
  destructive: boolean;
  confirm_required: boolean;
}

/** One ready made question in the "Browse topics" catalog. Sending it back as
 * `presetIntent` on `ask` skips free text classification entirely -- a preset
 * answer is exactly as reliable as its own Intent, never a best guess at
 * what was clicked. */
export interface SupportPreset {
  id: string;
  label: string;
  message: string;
  intent: string;
}

export interface SupportPresetCategory {
  label: string;
  options: SupportPreset[];
}

/**
 * Ask Support a question. Read-only: this never changes platform state, only
 * composes an answer from it. The full turn history is sent every time, since
 * the server holds no conversation of its own.
 *
 * Pass `presetIntent` when the question came from a preset button rather
 * than free typing (see `presets()` below) -- the server then answers from
 * that Intent directly, with none of the misclassification risk open ended
 * text carries.
 */
export function ask(
  message: string,
  history: SupportTurn[],
  context: SupportContext,
  signal?: AbortSignal,
  presetIntent?: string,
): Promise<SupportResponse> {
  return apiRequest<SupportResponse>('/support/ask', {
    method: 'POST',
    body: { message, history, context, preset_intent: presetIntent ?? '' },
    signal,
  });
}

/**
 * Fetch the full "Browse topics" preset catalog: ready made questions
 * grouped by category, each answerable with certainty. Platform
 * administration only appears in the response for an account that actually
 * holds the Admin role.
 */
export function presets(signal?: AbortSignal): Promise<SupportPresetCategory[]> {
  return apiRequest<{ categories?: SupportPresetCategory[] }>('/support/presets', { signal }).then(
    (r) => r.categories ?? [],
  );
}

/**
 * Run a Support-offered action. The caller is responsible for having shown a
 * confirmation step first when the action was `destructive` or
 * `confirm_required` -- this call itself performs no confirmation of its own,
 * it executes.
 */
export function confirmAction(
  actionId: string,
  params: Record<string, unknown>,
  context: SupportContext,
  signal?: AbortSignal,
): Promise<SupportActionResult> {
  return apiRequest<SupportActionResult>(`/support/actions/${encodeURIComponent(actionId)}/confirm`, {
    method: 'POST',
    body: { params, context },
    signal,
  });
}

/** Fetch the quick-action chips for a given resource, shown before the
 * Operator has typed anything. Either field may be omitted for a page with no
 * specific resource in view. */
export function quickActions(
  resourceType: string | null,
  resourceId: string | null,
  signal?: AbortSignal,
): Promise<SupportQuickAction[]> {
  return apiRequest<{ actions?: SupportQuickAction[] }>('/support/quick-actions', {
    query: {
      resource_type: resourceType ?? undefined,
      resource_id: resourceId ?? undefined,
    },
    signal,
  }).then((r) => r.actions ?? []);
}
