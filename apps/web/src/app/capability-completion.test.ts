import type { Capability, CapabilityState } from '@slideops/api-client';
import { describe, expect, it } from 'vitest';
import {
  blockedBy,
  completedHint,
  completionLabel,
  detectedHint,
  detectedLabel,
  isDetected,
  orderByDependencies,
} from './capability-completion';

const NOW = new Date('2026-07-26T12:00:00Z');

/** A state SlideOps recorded, from a completed Operation. */
function doneState(completedAt: string): CapabilityState {
  return {
    status: 'done',
    source: 'slideops',
    last_operation_id: 'op_1',
    last_completed_at: completedAt,
  };
}

/** A state read off the server as it already was. */
function detectedState(overrides: Partial<CapabilityState> = {}): CapabilityState {
  return {
    status: 'detected',
    source: 'existing',
    evidence: 'Docker is already installed on this server and is running.',
    running: true,
    detected_at: '2026-07-26T11:00:00Z',
    ...overrides,
  };
}

describe('the words for an outcome already in place', () => {
  it('names the outcome from the Capability key', () => {
    expect(completionLabel('install-postgresql')).toBe('Installed');
    expect(completionLabel('enable-containers')).toBe('Enabled');
    expect(completionLabel('configure-https')).toBe('Configured');
    expect(completionLabel('secure-ssh')).toBe('Secured');
    expect(completionLabel('server-audit')).toBe('Done');
  });

  it('marks a detected state and leaves a recorded one alone', () => {
    expect(isDetected(detectedState())).toBe(true);
    expect(isDetected(doneState('2026-07-26T11:00:00Z'))).toBe(false);
    expect(isDetected(undefined)).toBe(false);
  });

  it('says "already installed" for something found on the server', () => {
    expect(detectedLabel('install-postgresql')).toBe('Already installed');
    expect(detectedLabel('enable-containers')).toBe('Already enabled');
  });

  // A detected outcome is an observation about the Operator's server, never a
  // claim that SlideOps did the work.
  it('reads the evidence and when it was found, without claiming SlideOps did it', () => {
    const hint = detectedHint(detectedState(), NOW);
    expect(hint).toContain('Docker is already installed');
    expect(hint).toContain('1 hour ago');
    expect(hint).not.toContain('SlideOps ');
  });

  it('falls back to a plain sentence when a state carries no evidence', () => {
    const hint = detectedHint(detectedState({ evidence: '', detected_at: undefined }), NOW);
    expect(hint).toBe('This was already in place when SlideOps looked.');
  });

  it('still reads a recorded completion as work SlideOps did', () => {
    expect(completedHint('install-postgresql', '2026-07-26T11:00:00Z', undefined, NOW)).toBe(
      'Already installed 1 hour ago',
    );
  });

  it('names the version the completing Operation actually ran with', () => {
    expect(completedHint('install-postgresql', '2026-07-26T11:00:00Z', '16', NOW)).toBe(
      'Already installed (version 16) 1 hour ago',
    );
  });

  it('omits the version for a Capability with none recorded, existing installs included', () => {
    expect(
      completedHint('install-postgresql', '2026-07-26T11:00:00Z', undefined, NOW),
    ).not.toContain('version');
  });
});

function cap(key: string, overrides: Partial<Capability> = {}): Capability {
  return {
    key,
    name: key,
    category: 'security',
    description: '',
    risk_level: 'medium',
    ...overrides,
  };
}

describe('blockedBy', () => {
  const createAppUser = cap('create-app-user', { name: 'Create application user' });
  const secureSSH = cap('secure-ssh', { name: 'Secure SSH', dependencies: ['create-app-user'] });
  const byKey = new Map([
    [createAppUser.key, createAppUser],
    [secureSSH.key, secureSSH],
  ]);

  it('names the unmet prerequisite with its display title', () => {
    const missing = blockedBy(secureSSH, byKey, {});
    expect(missing).toEqual([{ key: 'create-app-user', title: 'Create application user' }]);
  });

  it('is empty once the prerequisite is done', () => {
    const missing = blockedBy(secureSSH, byKey, {
      'create-app-user': doneState('2026-01-01T00:00:00Z'),
    });
    expect(missing).toEqual([]);
  });

  it('is empty once the prerequisite is only detected, exactly the same as done', () => {
    const missing = blockedBy(secureSSH, byKey, { 'create-app-user': detectedState() });
    expect(missing).toEqual([]);
  });

  it('is empty for a Capability with no declared Dependencies', () => {
    expect(blockedBy(createAppUser, byKey, {})).toEqual([]);
  });

  it('falls back to the bare key when the prerequisite is not in the known catalog', () => {
    const orphan = cap('depends-on-unknown', { dependencies: ['not-in-catalog'] });
    expect(blockedBy(orphan, new Map([[orphan.key, orphan]]), {})).toEqual([
      { key: 'not-in-catalog', title: 'not-in-catalog' },
    ]);
  });
});

describe('orderByDependencies', () => {
  // Deliberately catalog order unrelated to the real dependency chain, the
  // way the backend actually returns Core Capabilities today, so this proves
  // the ordering is doing real work rather than happening to already be sorted.
  const fail2ban = cap('install-fail2ban', { dependencies: ['configure-firewall'] });
  const firewall = cap('configure-firewall', { dependencies: ['secure-ssh'] });
  const secureSSH = cap('secure-ssh', { dependencies: ['create-app-user'] });
  const createAppUser = cap('create-app-user');
  const unrelated = cap('enable-auto-updates');
  const catalog = [fail2ban, firewall, unrelated, secureSSH, createAppUser];

  it('never places a Capability ahead of its own unmet prerequisite, on an untouched server', () => {
    const ordered = orderByDependencies(catalog, {});
    const position = new Map(ordered.map((c, i) => [c.key, i]));
    expect(position.get('create-app-user')).toBeLessThan(position.get('secure-ssh')!);
    expect(position.get('secure-ssh')).toBeLessThan(position.get('configure-firewall')!);
    expect(position.get('configure-firewall')).toBeLessThan(position.get('install-fail2ban')!);
  });

  it('keeps a Capability with no Dependencies in its original relative position', () => {
    const ordered = orderByDependencies(catalog, {});
    // enable-auto-updates has no dependents to satisfy and no dependencies of
    // its own, so it stays at depth 0 and keeps its catalog-order tiebreak.
    const position = new Map(ordered.map((c, i) => [c.key, i]));
    expect(position.get('enable-auto-updates')).toBeLessThan(position.get('secure-ssh')!);
  });

  it('stops reordering once every prerequisite in the chain is already satisfied', () => {
    const done: Record<string, CapabilityState> = {
      'create-app-user': doneState('2026-01-01T00:00:00Z'),
      'secure-ssh': doneState('2026-01-01T00:00:00Z'),
      'configure-firewall': doneState('2026-01-01T00:00:00Z'),
    };
    const ordered = orderByDependencies(catalog, done);
    // Nothing left to block install-fail2ban, so the original catalog order
    // (fail2ban first) is exactly preserved.
    expect(ordered.map((c) => c.key)).toEqual(catalog.map((c) => c.key));
  });
});
