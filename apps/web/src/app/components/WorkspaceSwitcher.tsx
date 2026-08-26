import { cn } from '@slideops/design-system';
import { Building2, Check, ChevronsUpDown } from '@slideops/icons';
import { Popover } from '@slideops/tooltips';
import { useState } from 'react';
import { activeWorkspace, useWorkspaceStore } from '../../store/workspace';
import { useAuthStore } from '../../store/auth';

const roleLabel: Record<string, string> = {
  owner: 'Owner',
  admin: 'Admin',
  member: 'Member',
  viewer: 'Viewer',
};

/**
 * Which workspace the Operator is acting in, and a way to switch. Renders
 * nothing until there is more than one workspace to choose between: an
 * Operator who has never invited anyone and never accepted an invitation has
 * exactly one, their own, and a control that only ever offers one choice is
 * not a control, it is clutter.
 */
export function WorkspaceSwitcher() {
  const workspaces = useWorkspaceStore((state) => state.workspaces);
  const switchTo = useWorkspaceStore((state) => state.switchTo);
  const ownOperatorId = useAuthStore((state) => state.operator?.id);
  const [switching, setSwitching] = useState('');

  if (workspaces.length <= 1) {
    return null;
  }

  const active = activeWorkspace(workspaces) ?? workspaces[0];

  const onSelect = async (ownerOperatorId: string) => {
    if (ownerOperatorId === active?.owner_operator_id) {
      return;
    }
    setSwitching(ownerOperatorId);
    try {
      await switchTo(ownerOperatorId);
    } finally {
      setSwitching('');
    }
  };

  return (
    <Popover
      label="Switch workspace"
      placement="bottom"
      trigger={(props) => (
        <button
          type="button"
          className="inline-flex h-9 max-w-48 items-center gap-2 rounded-md border border-border bg-surface px-2.5 text-sm text-ink transition-colors duration-fast ease-standard hover:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          {...props}
        >
          <Building2 width={16} height={16} className="shrink-0 text-ink-muted" aria-hidden />
          <span className="min-w-0 truncate">
            {active?.owner_operator_id === ownOperatorId ? 'Your workspace' : active?.owner_email}
          </span>
          <ChevronsUpDown width={14} height={14} className="ml-auto shrink-0 text-ink-muted" aria-hidden />
        </button>
      )}
    >
      <div className="flex w-64 flex-col gap-1">
        <p className="px-1 pb-1 text-xs font-semibold uppercase tracking-wide text-ink-muted">
          Workspaces
        </p>
        {workspaces.map((workspace) => (
          <button
            key={workspace.owner_operator_id}
            type="button"
            disabled={switching !== ''}
            onClick={() => void onSelect(workspace.owner_operator_id)}
            className={cn(
              'flex items-center gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors duration-fast ease-standard hover:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus',
              workspace.active ? 'bg-subtle' : undefined,
            )}
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-ink">
                {workspace.owner_operator_id === ownOperatorId ? 'Your workspace' : workspace.owner_email}
              </p>
              <p className="text-xs text-ink-muted">
                {switching === workspace.owner_operator_id
                  ? 'Switching...'
                  : roleLabel[workspace.role] ?? workspace.role}
              </p>
            </div>
            {workspace.active ? (
              <Check width={16} height={16} className="shrink-0 text-brand" aria-hidden />
            ) : null}
          </button>
        ))}
      </div>
    </Popover>
  );
}
