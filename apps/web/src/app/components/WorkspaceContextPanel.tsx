import { cn } from '@slideops/design-system';
import { Building2, Users, type LucideIcon } from '@slideops/icons';
import { Tooltip } from '@slideops/tooltips';
import { useNavigate } from 'react-router-dom';

/*
 * The two pages about the workspace itself, kept apart from what the Operator
 * wants to do inside one.
 *
 * They were once ordinary entries among Servers and Projects, which read as
 * though a workspace were another kind of infrastructure. It is not: it is the
 * frame everything below it happens inside. So they get their own small block
 * at the top of the sidebar, with a rule under it, and they appear in no group.
 *
 * The switcher is not here. Which workspace is being operated is a question
 * about the whole page, so it is asked once in the top bar beside search, and
 * mounting it a second time here would double the pending invitation and node
 * transfer reads it makes on every page.
 */

/** Where this block can lead. Deliberately only these two. */
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

/** The workspace block: the two pages about the workspace, and nothing else. */
export function WorkspaceContextPanel({
  current,
  rail,
}: {
  current: WorkspaceContextTarget;
  rail: boolean;
}) {
  const navigate = useNavigate();
  // Rows stretch rather than centre: in the rail each entry centres its own
  // icon inside a full width row, so the two line up with the navigation below
  // them instead of drifting off it.
  return (
    <section aria-label="Workspace" className="flex flex-col gap-0.5">
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
    </section>
  );
}
