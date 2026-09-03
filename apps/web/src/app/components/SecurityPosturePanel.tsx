import type { CapabilityState } from '@slideops/api-client';
import { Text } from '@slideops/design-system';
import { Check, ShieldCheck, X } from '@slideops/icons';
import { useNavigate } from 'react-router-dom';
import { completedAgo, isDetected } from '../capability-completion';

/*
 * A posture checklist folding in what the platform already knows about a
 * Node's security Capabilities, rather than asking it a new question the way
 * the other Stage E panels do. web, messaging, storage, search, runtime, and
 * networking all needed a new read Action because nothing already answered
 * their question; whether fail2ban, automatic updates, key-only SSH, and a
 * server audit are in place is already exactly what getCapabilityStates
 * answers for every Capability on a Node, so this only needed to be shown
 * together as a checklist rather than one description page at a time.
 */

interface SecurityChecklistItem {
  key: string;
  label: string;
  description: string;
}

const SECURITY_CHECKLIST: SecurityChecklistItem[] = [
  { key: 'install-fail2ban', label: 'Fail2ban', description: 'Bans an address after repeated failed logins.' },
  { key: 'enable-auto-updates', label: 'Automatic security updates', description: 'Applies security patches on their own schedule.' },
  { key: 'enforce-key-only-ssh', label: 'Key-only SSH', description: 'Turns off password sign-in over SSH.' },
  { key: 'server-audit', label: 'Server audit', description: 'A point-in-time review of this server’s security posture.' },
];

interface SecurityPosturePanelProps {
  states: Record<string, CapabilityState>;
  nodeId: string;
  projectId?: string;
}

export function SecurityPosturePanel({ states, nodeId, projectId }: SecurityPosturePanelProps) {
  const navigate = useNavigate();
  const query = `?node=${nodeId}${projectId ? `&project=${projectId}` : ''}`;

  return (
    <div className="flex flex-col gap-2 rounded-md border border-border bg-surface p-1">
      {SECURITY_CHECKLIST.map((item) => {
        const state = states[item.key];
        const done = Boolean(state) && !isDetected(state);
        const detected = Boolean(state) && isDetected(state);
        const inPlace = done || detected;
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => navigate(`/app/capabilities/${item.key}${query}`)}
            className="flex items-start gap-3 rounded-md p-3 text-left transition-colors duration-fast ease-standard hover:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          >
            <span
              className={`mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-pill ${
                inPlace ? 'bg-success/15 text-success' : 'bg-subtle text-ink-muted'
              }`}
            >
              {inPlace ? <Check width={14} height={14} aria-hidden /> : <X width={14} height={14} aria-hidden />}
            </span>
            <span className="min-w-0 flex-1">
              <Text variant="body-sm" className="font-medium text-ink">
                {item.label}
              </Text>
              <Text variant="caption" tone="secondary" className="mt-0.5 block">
                {item.description}
              </Text>
              {state?.last_completed_at ? (
                <Text variant="caption" tone="secondary" className="mt-0.5 block">
                  {detected ? 'Found already in place' : `Done ${completedAgo(state.last_completed_at)}`}
                </Text>
              ) : (
                <Text variant="caption" tone="secondary" className="mt-0.5 block">
                  Not set up yet
                </Text>
              )}
            </span>
          </button>
        );
      })}
      <div className="flex items-center gap-2 border-t border-border px-3 pt-3 text-xs text-ink-muted">
        <ShieldCheck width={13} height={13} aria-hidden />
        Each row opens that Capability so you can set it up or see what it found.
      </div>
    </div>
  );
}
