import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DockerEvent } from '@slideops/api-client';
import { renderInApp } from '../../test/render';
import { DockerEventsPanel } from './DockerEventsPanel';

/*
 * The live event viewer.
 *
 * What matters: Docker's own words reach the screen unrenamed, newest first;
 * pausing holds events instead of losing them; and a stream that cannot
 * continue says so out loud. The last one is the reason this panel is worth
 * testing at all, because a live view that stops updating quietly looks exactly
 * like a server on which nothing is happening.
 */

class FakeSocket {
  static last: FakeSocket | null = null;
  static instances: FakeSocket[] = [];
  static readonly OPEN = 1;

  readyState = 0;
  private listeners: Record<string, Array<(event: unknown) => void>> = {};

  constructor(public url: string) {
    FakeSocket.last = this;
    FakeSocket.instances.push(this);
  }

  addEventListener(type: string, handler: (event: unknown) => void) {
    (this.listeners[type] ??= []).push(handler);
  }

  close() {
    this.readyState = 3;
  }

  emit(type: string, event: unknown) {
    for (const handler of this.listeners[type] ?? []) {
      handler(event);
    }
  }

  openIt() {
    this.readyState = FakeSocket.OPEN;
    this.emit('open', {});
  }

  message(data: unknown) {
    this.emit('message', { data: JSON.stringify(data) });
  }
}

function dockerEvent(overrides: Partial<DockerEvent> = {}): DockerEvent {
  return {
    type: 'container',
    action: 'die',
    actor_id: 'abc123',
    actor_name: 'shop-api',
    attributes: { exitCode: '137', image: 'ghcr.io/acme/api:1.0.0' },
    at: '2026-02-01T10:00:00Z',
    ...overrides,
  };
}

function send(event: DockerEvent) {
  FakeSocket.last!.message({ kind: 'event', event });
}

/**
 * The event list only. An action name appears twice on the page once it has
 * arrived -- in the row and in the filter's own options -- so every assertion
 * about what was reported is scoped to the list that reports it.
 */
function inList() {
  return within(screen.getByRole('list'));
}

beforeEach(() => {
  FakeSocket.last = null;
  FakeSocket.instances = [];
  vi.stubGlobal('WebSocket', FakeSocket as unknown as typeof WebSocket);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('DockerEventsPanel', () => {
  it('shows each event in Docker\'s own words, newest first', async () => {
    renderInApp(<DockerEventsPanel nodeId="node-1" />);
    FakeSocket.last!.openIt();

    send(dockerEvent());
    send(dockerEvent({ action: 'start', attributes: {}, at: '2026-02-01T10:00:05Z' }));

    await waitFor(() => expect(screen.getAllByRole('listitem')).toHaveLength(2));
    expect(inList().getByText('start')).toBeInTheDocument();
    // "die" is Docker's word and stays Docker's word: no invented "Stopped".
    expect(inList().getByText('die')).toBeInTheDocument();
    expect(inList().queryByText(/^stopped$/i)).not.toBeInTheDocument();
    expect(inList().getByText('exitCode=137')).toBeInTheDocument();

    const rows = screen.getAllByRole('listitem');
    expect(rows[0]).toHaveTextContent('start');
    expect(rows[1]).toHaveTextContent('die');
  });

  it('narrows to one action, and back', async () => {
    renderInApp(<DockerEventsPanel nodeId="node-1" />);
    FakeSocket.last!.openIt();
    send(dockerEvent({ actor_name: 'shop-api' }));
    send(dockerEvent({ action: 'pull', type: 'image', actor_name: 'ghcr.io/acme/api:1.0.0' }));

    await waitFor(() => expect(screen.getAllByRole('listitem')).toHaveLength(2));
    await userEvent.selectOptions(screen.getByLabelText('Action'), 'pull');

    await waitFor(() => expect(screen.getAllByRole('listitem')).toHaveLength(1));
    expect(screen.getByText('1 of 2')).toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText('Action'), '');
    await waitFor(() => expect(screen.getAllByRole('listitem')).toHaveLength(2));
  });

  it('searches across the actor and the attributes Docker attached', async () => {
    renderInApp(<DockerEventsPanel nodeId="node-1" />);
    FakeSocket.last!.openIt();
    send(dockerEvent({ actor_name: 'shop-api' }));
    send(dockerEvent({ actor_name: 'shop-db', attributes: { exitCode: '0' } }));

    await waitFor(() => expect(screen.getAllByRole('listitem')).toHaveLength(2));
    await userEvent.type(screen.getByLabelText('Search events'), 'shop-db');

    await waitFor(() => expect(screen.getAllByRole('listitem')).toHaveLength(1));
    expect(inList().getByText('shop-db')).toBeInTheDocument();
  });

  it('holds new events while paused and puts them back on resume', async () => {
    renderInApp(<DockerEventsPanel nodeId="node-1" />);
    FakeSocket.last!.openIt();
    send(dockerEvent({ action: 'start' }));
    await waitFor(() => expect(screen.getAllByRole('listitem')).toHaveLength(1));

    await userEvent.click(screen.getByRole('button', { name: /pause/i }));
    send(dockerEvent({ action: 'die' }));

    // Held, not dropped: pausing to read a line must not cost the Operator
    // everything that happens while they read it.
    expect(await screen.findByText(/1 event is held/i)).toBeInTheDocument();
    expect(inList().queryByText('die')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /resume/i }));
    await waitFor(() => expect(screen.getAllByRole('listitem')).toHaveLength(2));
    expect(inList().getByText('die')).toBeInTheDocument();
  });

  it('surfaces a stream error as a terminal state rather than stopping quietly', async () => {
    renderInApp(<DockerEventsPanel nodeId="node-1" />);
    FakeSocket.last!.openIt();
    FakeSocket.last!.message({
      kind: 'error',
      message: 'Docker is not running on this server.',
    });

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Docker is not running on this server.',
    );
    expect(screen.getByText('Stopped')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });

  it('opens a new stream when the Operator tries a stopped one again', async () => {
    renderInApp(<DockerEventsPanel nodeId="node-1" />);
    FakeSocket.last!.openIt();
    FakeSocket.last!.message({ kind: 'error', message: 'The daemon closed the connection.' });
    await screen.findByRole('alert');

    expect(FakeSocket.instances).toHaveLength(1);
    await userEvent.click(screen.getByRole('button', { name: /try again/i }));

    await waitFor(() => expect(FakeSocket.instances).toHaveLength(2));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('says an empty stream is an empty stream, not an empty server history', async () => {
    renderInApp(<DockerEventsPanel nodeId="node-1" />);
    FakeSocket.last!.openIt();

    expect(
      await screen.findByText(/Nothing has happened on this server since this panel opened/i),
    ).toBeInTheDocument();
  });
});
