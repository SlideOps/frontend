import type { CapabilityState } from '@slideops/api-client';
import { describe, expect, it } from 'vitest';
import {
  completedHint,
  completionLabel,
  detectedHint,
  detectedLabel,
  isDetected,
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
    expect(completedHint('install-postgresql', '2026-07-26T11:00:00Z', NOW)).toBe(
      'Already installed 1 hour ago',
    );
  });
});
