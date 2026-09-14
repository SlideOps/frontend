import type { ApiError, SupportAction, SupportCard, SupportFollowUp, SupportNavigation, SupportResponse, SupportTurn } from '@slideops/api-client';

/*
 * Support conversation state, kept as pure functions and a reducer for the
 * same reason command-palette.ts is: the turn-taking and history-building
 * logic is what matters for correctness, and it is testable without a DOM.
 *
 * The server holds no session of its own (see the architecture plan) -- every
 * request carries the full turn history, so this reducer is also what
 * assembles that history from what is already on screen.
 */

export type ConversationRole = 'operator' | 'support';

/** One rendered turn. An operator turn is just text; a support turn carries
 * whatever the Response Composer attached to its answer. */
export interface ConversationMessage {
  id: string;
  role: ConversationRole;
  text: string;
  confidence?: SupportResponse['confidence'];
  cards?: SupportCard[];
  actions?: SupportAction[];
  navigation?: SupportNavigation | null;
  followUp?: SupportFollowUp | null;
}

export type ConversationStatus = 'idle' | 'loading' | 'error';

export interface ConversationState {
  messages: ConversationMessage[];
  status: ConversationStatus;
  error: ApiError | null;
}

export const initialConversationState: ConversationState = {
  messages: [],
  status: 'idle',
  error: null,
};

export type ConversationAction =
  | { type: 'send'; id: string; text: string }
  | { type: 'receive'; response: SupportResponse }
  | { type: 'error'; error: ApiError }
  | { type: 'reset' };

export function conversationReducer(
  state: ConversationState,
  action: ConversationAction,
): ConversationState {
  switch (action.type) {
    case 'send':
      return {
        ...state,
        status: 'loading',
        error: null,
        messages: [...state.messages, { id: action.id, role: 'operator', text: action.text }],
      };
    case 'receive':
      return {
        ...state,
        status: 'idle',
        error: null,
        messages: [
          ...state.messages,
          {
            id: crypto.randomUUID(),
            role: 'support',
            text: action.response.text,
            confidence: action.response.confidence,
            cards: action.response.cards,
            actions: action.response.actions,
            navigation: action.response.navigation,
            followUp: action.response.follow_up,
          },
        ],
      };
    case 'error':
      return { ...state, status: 'error', error: action.error };
    case 'reset':
      return initialConversationState;
    default:
      return state;
  }
}

/** The wire history for the next request: every turn rendered so far, in the
 * shape the backend expects, dropping the extras a support turn carries. */
export function toHistory(messages: ConversationMessage[]): SupportTurn[] {
  return messages.map((message) => ({ role: message.role, text: message.text }));
}
