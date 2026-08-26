import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Drawer } from './Drawer';

describe('Drawer', () => {
  it('renders nothing when closed', () => {
    render(
      <Drawer open={false} onClose={() => {}} title="Row">
        content
      </Drawer>,
    );
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('renders its title and content when open', () => {
    render(
      <Drawer open onClose={() => {}} title="Row 42">
        the document
      </Drawer>,
    );
    expect(screen.getByRole('dialog', { name: 'Row 42' })).toBeDefined();
    expect(screen.getByText('the document')).toBeDefined();
  });

  it('closes on the close button', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <Drawer open onClose={onClose} title="Row">
        content
      </Drawer>,
    );
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('closes on Escape', () => {
    const onClose = vi.fn();
    render(
      <Drawer open onClose={onClose} title="Row">
        content
      </Drawer>,
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('closes on a backdrop click but not on a click inside the panel', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <Drawer open onClose={onClose} title="Row">
        content
      </Drawer>,
    );
    await user.click(screen.getByText('content'));
    expect(onClose).not.toHaveBeenCalled();

    await user.click(screen.getByRole('dialog').parentElement!);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('renders a footer when given one', () => {
    render(
      <Drawer open onClose={() => {}} title="Row" footer={<span>Save</span>}>
        content
      </Drawer>,
    );
    expect(screen.getByText('Save')).toBeDefined();
  });
});
