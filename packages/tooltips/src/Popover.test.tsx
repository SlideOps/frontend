import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Popover } from './Popover';

/*
 * A popover anchored by its left edge opens rightward, which is correct for a
 * trigger sitting in the body of a page and wrong for one pinned to the right of
 * the header: there the panel opens straight off the screen. Alignment is opt in
 * so every existing popover keeps the behaviour it was written against.
 */

function show(props: Partial<Parameters<typeof Popover>[0]> = {}) {
  return render(
    <Popover
      label="Notifications"
      trigger={(triggerProps) => <button {...triggerProps}>Open</button>}
      {...props}
    >
      <p>Panel content</p>
    </Popover>,
  );
}

describe('Popover', () => {
  it('opens from the trigger left edge unless told otherwise', () => {
    show();

    fireEvent.click(screen.getByRole('button', { name: 'Open' }));

    expect(screen.getByRole('dialog', { name: 'Notifications' }).className).toContain('left-0');
  });

  it('opens inward from the trigger right edge when aligned to the end', () => {
    show({ align: 'end' });

    fireEvent.click(screen.getByRole('button', { name: 'Open' }));

    const panel = screen.getByRole('dialog', { name: 'Notifications' });
    expect(panel.className).toContain('right-0');
    expect(panel.className).not.toContain('left-0');
  });

  it('still closes on escape whichever edge it is aligned to', () => {
    show({ align: 'end' });
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(screen.queryByRole('dialog', { name: 'Notifications' })).toBeNull();
  });
});
