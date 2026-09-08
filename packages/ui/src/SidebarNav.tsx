import { cn, prefersReducedMotion } from '@slideops/design-system';
import { ChevronDown, type LucideIcon } from '@slideops/icons';
import { Tooltip } from '@slideops/tooltips';
import { memo, useEffect, useId, useRef, useState, type ReactNode } from 'react';

/*
 * The grouped sidebar navigation, shared by the Operator and the Admin surface.
 *
 * A flat list of two dozen equally weighted destinations makes an Operator read
 * all of them to find one. Grouping says what each part of the product is for
 * before they have to guess, and collapsing keeps the parts they are not using
 * today out of the way without putting them out of reach.
 */

export interface NavItem {
  key: string;
  label: string;
  icon: LucideIcon;
  /** Whether this is the destination currently on screen. */
  active?: boolean;
  onSelect?: () => void;
}

export interface NavGroup {
  /** Stable identity, used as the key in the stored preferences. */
  key: string;
  /** Written in sentence case; the styling does the shouting, not the copy. */
  label: string;
  items: NavItem[];
}

export interface SidebarNavProps {
  /** Entries above every group, always visible and never collapsible. */
  primary: NavItem[];
  groups: NavGroup[];
  /** Keys of the groups the Operator has closed. */
  collapsedGroups: readonly string[];
  onToggleGroup: (key: string) => void;
  /** Icon rail mode: labels move into tooltips, the hierarchy stays visible. */
  rail?: boolean;
}

/*
 * Matches --so-duration-fast. The collapsing panel keeps its contents in the
 * accessibility tree only while they are still on screen, so this has to agree
 * with the CSS or the panel either vanishes mid-animation or lingers as a
 * keyboard target after it looks gone.
 */
const COLLAPSE_DURATION_MS = 120;

/** Whether this Operator has asked their system for less movement. */
function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(prefersReducedMotion);
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setReduced(query.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);
  return reduced;
}

/** One destination. In the rail its label moves to a tooltip rather than away. */
function NavButton({ item, rail }: { item: NavItem; rail: boolean }) {
  const Icon = item.icon;
  const button = (
    <button
      type="button"
      onClick={item.onSelect}
      aria-current={item.active ? 'page' : undefined}
      aria-label={rail ? item.label : undefined}
      className={cn(
        'relative flex items-center rounded-md text-sm transition-colors duration-fast ease-standard',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus',
        rail ? 'h-9 w-9 justify-center' : 'w-full gap-2.5 px-2.5 py-1.5',
        item.active
          ? 'bg-subtle font-medium text-ink'
          : 'font-normal text-ink-muted hover:bg-subtle hover:text-ink',
      )}
    >
      {/* The one unmistakable mark of the current page. It sits on the button's
          own edge so an active row reads the same whether the sidebar is wide
          or reduced to the rail. */}
      {item.active ? (
        <span aria-hidden className="absolute inset-y-1.5 left-0 w-0.5 rounded-pill bg-brand" />
      ) : null}
      <Icon width={16} height={16} className="shrink-0" aria-hidden />
      {rail ? null : <span className="truncate">{item.label}</span>}
    </button>
  );

  if (!rail) {
    return button;
  }
  return (
    <div className="flex justify-center">
      <Tooltip content={item.label} placement="right">
        {button}
      </Tooltip>
    </div>
  );
}

/**
 * The part of a group that opens and closes.
 *
 * Height is animated from a zero row to an auto row so the sidebar below it
 * slides rather than snaps, and only this column moves: the page beside it is
 * untouched. While it is closing the contents are still on screen, so they stay
 * in the accessibility tree until the movement finishes and are taken out of it
 * afterwards, which keeps a keyboard from tabbing into something invisible.
 */
function GroupPanel({
  id,
  labelledBy,
  open,
  reduced,
  children,
}: {
  id: string;
  labelledBy: string;
  open: boolean;
  reduced: boolean;
  children: ReactNode;
}) {
  const [onScreen, setOnScreen] = useState(open);
  const [expanded, setExpanded] = useState(open);
  // The first paint is the stored state, arrived at rather than animated to.
  // Animating into it would be the sidebar rearranging itself in front of an
  // Operator who has not touched anything yet.
  const previousOpen = useRef(open);

  useEffect(() => {
    if (previousOpen.current === open) {
      return;
    }
    previousOpen.current = open;
    if (reduced) {
      setOnScreen(open);
      setExpanded(open);
      return;
    }
    if (open) {
      setOnScreen(true);
      // A second frame, so the closed height is painted before the open one.
      // Setting both in one commit gives the browser nothing to animate from.
      const frame = requestAnimationFrame(() => setExpanded(true));
      return () => cancelAnimationFrame(frame);
    }
    setExpanded(false);
    const timer = setTimeout(() => setOnScreen(false), COLLAPSE_DURATION_MS);
    return () => clearTimeout(timer);
  }, [open, reduced]);

  return (
    <div
      id={id}
      role="group"
      aria-labelledby={labelledBy}
      hidden={!onScreen}
      // The display class has to move with the attribute: a Tailwind display
      // utility outranks the browser's own rule for [hidden], so an attribute
      // on its own would hide this from assistive technology and nobody else.
      className={cn(
        onScreen ? 'grid' : 'hidden',
        reduced ? undefined : 'transition-[grid-template-rows,opacity] duration-fast ease-standard',
        expanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
      )}
    >
      <div className="overflow-hidden">
        <div className="flex flex-col gap-0.5 pb-1 pt-0.5">{children}</div>
      </div>
    </div>
  );
}

/** One group: a quiet heading that discloses its own destinations. */
function Group({
  group,
  open,
  onToggle,
  rail,
  reduced,
}: {
  group: NavGroup;
  open: boolean;
  onToggle: () => void;
  rail: boolean;
  reduced: boolean;
}) {
  const panelId = useId();
  const headerId = useId();
  const holdsCurrent = group.items.some((item) => item.active);

  const header = (
    <button
      type="button"
      id={headerId}
      aria-expanded={open}
      aria-controls={panelId}
      // Named as the scaffolding it is, so it is not mistaken for a destination
      // or for a same-named control on the page beside it. The visible word is
      // still the first word of the name, so speaking the label still works.
      aria-label={`${group.label} section`}
      onClick={onToggle}
      className={cn(
        'flex items-center rounded-md transition-colors duration-fast ease-standard',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus',
        rail
          ? 'h-6 w-9 justify-center'
          : 'w-full gap-2 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider',
        // Scaffolding, not a competing control: the heading is quiet until it
        // holds the page the Operator is on, and then only by a step in tone.
        holdsCurrent ? 'text-ink' : 'text-ink-muted',
        rail ? undefined : 'hover:text-ink',
      )}
    >
      {rail ? (
        <span aria-hidden className="h-px w-5 rounded-pill bg-border" />
      ) : (
        <>
          <span className="truncate">{group.label}</span>
          <ChevronDown
            width={13}
            height={13}
            aria-hidden
            className={cn(
              'ml-auto shrink-0 opacity-70',
              reduced ? undefined : 'transition-transform duration-fast ease-standard',
              open ? undefined : '-rotate-90',
            )}
          />
        </>
      )}
    </button>
  );

  return (
    <div className="pt-2 first:pt-0">
      {rail ? (
        <div className="flex justify-center">
          <Tooltip content={group.label} placement="right">
            {header}
          </Tooltip>
        </div>
      ) : (
        header
      )}
      <GroupPanel id={panelId} labelledBy={headerId} open={open} reduced={reduced}>
        {group.items.map((item) => (
          <NavButton key={item.key} item={item} rail={rail} />
        ))}
      </GroupPanel>
    </div>
  );
}

/**
 * The grouped navigation itself, without the frame around it.
 *
 * A group that holds the destination currently on screen is open whatever the
 * stored preferences say, so an Operator following a deep link never arrives at
 * a page whose own entry is hidden.
 */
/*
 * Memoised because the whole sidebar renders every destination at once now that
 * groups start open. Its props change only when the page or the collapsed set
 * does, while the shell around it re-renders on anything a screen does, so
 * without this the entire navigation was rebuilt on every keystroke typed into
 * any form on any page.
 */
export const SidebarNav = memo(function SidebarNav({
  primary,
  groups,
  collapsedGroups,
  onToggleGroup,
  rail = false,
}: SidebarNavProps) {
  const reduced = useReducedMotion();
  return (
    <div className="flex flex-col gap-0.5">
      {primary.map((item) => (
        <NavButton key={item.key} item={item} rail={rail} />
      ))}
      {groups.map((group) => (
        <Group
          key={group.key}
          group={group}
          open={!collapsedGroups.includes(group.key) || group.items.some((item) => item.active)}
          onToggle={() => onToggleGroup(group.key)}
          rail={rail}
          reduced={reduced}
        />
      ))}
    </div>
  );
});
