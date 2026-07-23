import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Tooltip } from './Tooltip';

describe('Tooltip', () => {
  it('shows on focus, describes the trigger, and hides on Escape', () => {
    render(
      <Tooltip content="Discovery only observes; it never changes a Node.">
        <button>Discover</button>
      </Tooltip>,
    );
    const trigger = screen.getByRole('button', { name: 'Discover' });

    expect(screen.queryByRole('tooltip')).toBeNull();

    fireEvent.focus(trigger);
    const tooltip = screen.getByRole('tooltip');
    expect(tooltip.textContent).toContain('Discovery only observes');
    expect(trigger.getAttribute('aria-describedby')).toBe(tooltip.id);

    fireEvent.keyDown(trigger, { key: 'Escape' });
    expect(screen.queryByRole('tooltip')).toBeNull();
  });
});
