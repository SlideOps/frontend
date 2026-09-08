import { cn } from '@slideops/design-system';
import { Building2, Users, type LucideIcon } from '@slideops/icons';
import { Tooltip } from '@slideops/tooltips';
import { useNavigate } from 'react-router-dom';
import { WorkspaceSwitcher } from './WorkspaceSwitcher';

/*
 * Which workspace is being operated, kept apart from what the Operator wants to
 * do in it.
 *
 * These two questions were previously answered by the same list, so "All
 * Workspaces" sat among Servers and Projects as though it were another kind of
 * infrastructure. It is not: it is the frame everything below it happens
 * inside. So it gets its own block at the top of the sidebar, with a rule under
 * it, and it appears nowhere in the navigation.
 */

/** Where the workspace block can lead. Deliberately only these two. */
export type WorkspaceContextTarget = 'workspaces' | 'team' | 'none';

function ContextLink({
  icon: Icon,
  label,
  active,
  rail,
  onSelect,
}: {
  icon: LucideIcon;
  label: string;
  active: boolean;
  rail: boolean;
  onSelect: () => void;
}) {
  const button = (
    <button
      type="button"
      onClick={onSelect}
      aria-current={active ? 'page' : undefined}
      aria-label={rail ? label : undefined}
      className={cn(
        'flex items-center rounded-md text-sm transition-colors duration-fast ease-standard',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus',
        rail ? 'h-8 w-9 justify-center' : 'w-full gap-2.5 px-2.5 py-1',
        active ? 'bg-subtle text-ink' : 'text-ink-muted hover:bg-subtle hover:text-ink',
      )}
    >
      <Icon width={15} height={15} className="shrink-0" aria-hidden />
      {rail ? null : <span className="truncate">{label}</span>}
    </button>
  );
  if (!rail) {
    return button;
  }
  return (
    <div className="flex justify-center">
      <Tooltip content={label} placement="right">
        {button}
      </Tooltip>
    </div>
  );
}

/** The workspace block: the current workspace, the switcher, and its two pages. */
export function WorkspaceContextPanel({
  current,
  rail,
}: {
  current: WorkspaceContextTarget;
  rail: boolean;
}) {
  const navigate = useNavigate();
  return (
    <section
      aria-label="Workspace"
      className={cn('flex flex-col gap-1', rail ? 'items-center' : undefined)}
    >
      <WorkspaceSwitcher variant={rail ? 'rail' : 'sidebar'} />
      <div className={cn('flex flex-col gap-0.5', rail ? 'w-full' : undefined)}>
        <ContextLink
          icon={Building2}
          label="All Workspaces"
          rail={rail}
          active={current === 'workspaces'}
          onSelect={() => navigate('/app/workspaces')}
        />
        <ContextLink
          icon={Users}
          label="Team"
          rail={rail}
          active={current === 'team'}
          onSelect={() => navigate('/app/team')}
        />
      </div>
    </section>
  );
}
