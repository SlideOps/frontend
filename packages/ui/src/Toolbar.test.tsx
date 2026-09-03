import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SearchBar, Toolbar } from './Toolbar';

describe('Toolbar', () => {
  it('renders its children and its actions apart', () => {
    render(
      <Toolbar actions={<button type="button">Export</button>}>
        <span>filter chip</span>
      </Toolbar>,
    );
    expect(screen.getByText('filter chip')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Export' })).toBeDefined();
  });
});

describe('SearchBar', () => {
  it('reports what was typed', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<SearchBar value="" onChange={onChange} label="Search users" />);

    await user.type(screen.getByRole('searchbox', { name: 'Search users' }), 'a');
    expect(onChange).toHaveBeenCalledWith('a');
  });

  it('shows a clear control only once there is something to clear', () => {
    const { rerender } = render(<SearchBar value="" onChange={() => {}} />);
    expect(screen.queryByRole('button', { name: 'Clear search' })).toBeNull();

    rerender(<SearchBar value="prudent" onChange={() => {}} />);
    expect(screen.getByRole('button', { name: 'Clear search' })).toBeDefined();
  });

  it('clears on the clear control', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<SearchBar value="prudent" onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: 'Clear search' }));
    expect(onChange).toHaveBeenCalledWith('');
  });
});
