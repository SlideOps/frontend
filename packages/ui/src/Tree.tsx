import { cn, Text } from '@slideops/design-system';
import { ChevronRight } from '@slideops/icons';
import type { ComponentType, SVGProps } from 'react';
import { useState, type ReactNode } from 'react';

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

/*
 * A collapsible hierarchy: an engine's databases, a database's tables or
 * collections, a bucket's objects. The same shape recurs across every storage
 * flavored capability, so it gets one component rather than a new one each time
 * a capability turns out to nest.
 *
 * Expansion is local state, not remembered. A tree that reopens exactly as an
 * Operator left it sounds convenient until the data underneath has changed
 * since: a table that was dropped stays expanded and empty rather than simply
 * being gone, which reads as broken rather than as changed.
 */

export interface TreeNode {
  id: string;
  label: ReactNode;
  icon?: IconComponent;
  /** A trailing caption, for a row count or a size. */
  meta?: ReactNode;
  /**
   * Omit entirely for a genuine leaf. An empty array marks a branch whose
   * children are not known yet, expandable and fetched lazily on first
   * expansion, which is the shape a database's tables or a bucket's objects
   * take before anything has asked to look inside them.
   */
  children?: TreeNode[];
}

export interface TreeProps {
  nodes: TreeNode[];
  selectedId?: string;
  onSelect?: (node: TreeNode) => void;
  defaultExpandedIds?: string[];
  className?: string;
}

export function Tree({ nodes, selectedId, onSelect, defaultExpandedIds, className }: TreeProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set(defaultExpandedIds ?? []));

  function toggle(id: string) {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  return (
    <ul role="tree" className={cn('flex flex-col gap-0.5', className)}>
      {nodes.map((node) => (
        <TreeItem
          key={node.id}
          node={node}
          depth={0}
          expanded={expanded}
          onToggle={toggle}
          selectedId={selectedId}
          onSelect={onSelect}
        />
      ))}
    </ul>
  );
}

function TreeItem({
  node,
  depth,
  expanded,
  onToggle,
  selectedId,
  onSelect,
}: {
  node: TreeNode;
  depth: number;
  expanded: Set<string>;
  onToggle: (id: string) => void;
  selectedId?: string;
  onSelect?: (node: TreeNode) => void;
}) {
  // undefined means a genuine leaf: nothing to expand, ever. An empty array
  // means a branch whose children have not been fetched yet, which a Tree
  // filling itself in lazily (a database whose tables are not known until it
  // is opened) needs to still read as expandable, not as empty and done.
  const hasChildren = node.children !== undefined;
  const isOpen = expanded.has(node.id);
  const isSelected = selectedId === node.id;
  const Icon = node.icon;

  function activate() {
    if (hasChildren) {
      onToggle(node.id);
    }
    onSelect?.(node);
  }

  return (
    <li role="treeitem" aria-expanded={hasChildren ? isOpen : undefined} aria-selected={isSelected}>
      <div
        role="button"
        tabIndex={0}
        onClick={activate}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            activate();
          } else if (event.key === 'ArrowRight' && hasChildren && !isOpen) {
            onToggle(node.id);
          } else if (event.key === 'ArrowLeft' && hasChildren && isOpen) {
            onToggle(node.id);
          }
        }}
        style={{ paddingLeft: `${depth * 1.25 + 0.5}rem` }}
        className={cn(
          'flex min-w-0 cursor-pointer items-center gap-1.5 rounded-md py-1.5 pr-2 text-sm',
          'transition-colors duration-fast ease-standard',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-inset',
          isSelected ? 'bg-subtle text-ink' : 'text-ink-muted hover:bg-subtle hover:text-ink',
        )}
      >
        <span className="flex h-4 w-4 shrink-0 items-center justify-center">
          {hasChildren ? (
            <ChevronRight
              width={13}
              height={13}
              aria-hidden
              className={cn('transition-transform duration-fast ease-standard', isOpen ? 'rotate-90' : '')}
            />
          ) : null}
        </span>
        {Icon ? <Icon width={14} height={14} aria-hidden className="shrink-0" /> : null}
        <span className="min-w-0 flex-1 truncate">{node.label}</span>
        {node.meta ? (
          <Text variant="caption" tone="secondary" className="shrink-0 normal-case tracking-normal">
            {node.meta}
          </Text>
        ) : null}
      </div>
      {hasChildren && isOpen ? (
        <ul role="group">
          {node.children!.map((child) => (
            <TreeItem
              key={child.id}
              node={child}
              depth={depth + 1}
              expanded={expanded}
              onToggle={onToggle}
              selectedId={selectedId}
              onSelect={onSelect}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}
