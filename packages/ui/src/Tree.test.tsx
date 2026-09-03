import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Tree, type TreeNode } from './Tree';

const nodes: TreeNode[] = [
  {
    id: 'app',
    label: 'app',
    children: [
      { id: 'app.users', label: 'users' },
      { id: 'app.orders', label: 'orders' },
    ],
  },
  { id: 'analytics', label: 'analytics' },
];

describe('Tree', () => {
  it('starts with every branch collapsed', () => {
    render(<Tree nodes={nodes} />);
    expect(screen.getByText('app')).toBeDefined();
    expect(screen.queryByText('users')).toBeNull();
  });

  it('expands a branch on click and reveals its children', async () => {
    const user = userEvent.setup();
    render(<Tree nodes={nodes} />);
    await user.click(screen.getByText('app'));
    expect(screen.getByText('users')).toBeDefined();
    expect(screen.getByText('orders')).toBeDefined();
  });

  it('honors defaultExpandedIds', () => {
    render(<Tree nodes={nodes} defaultExpandedIds={['app']} />);
    expect(screen.getByText('users')).toBeDefined();
  });

  it('calls onSelect with the node that was activated', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<Tree nodes={nodes} onSelect={onSelect} />);
    await user.click(screen.getByText('analytics'));
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'analytics' }));
  });

  it('treats an empty children array as an expandable branch, not a leaf with nothing in it', async () => {
    const user = userEvent.setup();
    render(<Tree nodes={[{ id: 'app', label: 'app', children: [] }]} />);
    // A leaf renders no button-like control that would react to a click by
    // trying to expand it; a branch does, and reports it through aria-expanded.
    expect(screen.getByRole('treeitem').getAttribute('aria-expanded')).toBe('false');
    await user.click(screen.getByText('app'));
    expect(screen.getByRole('treeitem').getAttribute('aria-expanded')).toBe('true');
  });

  it('selects a leaf from the keyboard with Enter', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<Tree nodes={nodes} defaultExpandedIds={['app']} onSelect={onSelect} />);
    (screen.getByText('users').closest('[role="button"]') as HTMLElement).focus();
    await user.keyboard('{Enter}');
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'app.users' }));
  });
});
