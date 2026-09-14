import type { ApiError, SupportResponse } from '@slideops/api-client';
import { describe, expect, it } from 'vitest';
import {
  conversationReducer,
  initialConversationState,
  toHistory,
  type ConversationState,
} from './support-conversation';

function response(over: Partial<SupportResponse> = {}): SupportResponse {
  return {
    text: 'Here is what I found.',
    confidence: 'high',
    cards: [],
    actions: [],
    navigation: null,
    follow_up: null,
    ...over,
  };
}

describe('conversationReducer', () => {
  it('appends an operator turn and enters loading on send', () => {
    const state = conversationReducer(initialConversationState, {
      type: 'send',
      id: 'm1',
      text: 'Why did this fail?',
    });

    expect(state.status).toBe('loading');
    expect(state.messages).toEqual([{ id: 'm1', role: 'operator', text: 'Why did this fail?' }]);
  });

  it('appends a support turn carrying the composed answer on receive', () => {
    const sent = conversationReducer(initialConversationState, {
      type: 'send',
      id: 'm1',
      text: 'Why did this fail?',
    });
    const state = conversationReducer(sent, {
      type: 'receive',
      response: response({
        text: 'The repository branch could not be found.',
        cards: [{ kind: 'operation', id: 'op_1', title: 'Deploy', subtitle: 'failed' }],
      }),
    });

    expect(state.status).toBe('idle');
    expect(state.messages).toHaveLength(2);
    const reply = state.messages[1];
    expect(reply?.role).toBe('support');
    expect(reply?.text).toBe('The repository branch could not be found.');
    expect(reply?.cards).toHaveLength(1);
  });

  it('sets an error status without discarding history on error', () => {
    const sent = conversationReducer(initialConversationState, {
      type: 'send',
      id: 'm1',
      text: 'redeploy this',
    });
    const error = { status: 500, code: 'internal_error', message: 'boom' } as ApiError;
    const state = conversationReducer(sent, { type: 'error', error });

    expect(state.status).toBe('error');
    expect(state.error).toBe(error);
    expect(state.messages).toHaveLength(1);
  });

  it('resets to the initial state', () => {
    const populated: ConversationState = {
      messages: [{ id: 'm1', role: 'operator', text: 'hi' }],
      status: 'error',
      error: { status: 500, code: 'internal_error', message: 'boom' } as ApiError,
    };

    expect(conversationReducer(populated, { type: 'reset' })).toEqual(initialConversationState);
  });
});

describe('toHistory', () => {
  it('drops support-only extras and keeps role and text only', () => {
    const history = toHistory([
      { id: 'm1', role: 'operator', text: 'why did this fail?' },
      {
        id: 'm2',
        role: 'support',
        text: 'the branch was missing',
        cards: [{ kind: 'operation', id: 'op_1', title: 'Deploy', subtitle: 'failed' }],
        actions: [{ id: 'retry', label: 'Retry', destructive: false, confirm_required: false, params: {} }],
      },
    ]);

    expect(history).toEqual([
      { role: 'operator', text: 'why did this fail?' },
      { role: 'support', text: 'the branch was missing' },
    ]);
  });
});
