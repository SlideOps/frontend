import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderInApp } from '../../test/render';
import { FloatingRefreshIndicator } from './FloatingRefreshIndicator';

/*
 * The whole point of this component is what it does not do: move the page.
 *
 * The inline badge it replaces took part in layout, so on a page polling every
 * five seconds the content below it grew and shrank twelve times a minute. A
 * test that only checked "does it say Refreshing" would have passed for that
 * one too, so what is asserted here is the positioning contract instead.
 */
describe('FloatingRefreshIndicator', () => {
  it('is taken out of the flow, so nothing below it can move', () => {
    const { container } = renderInApp(<FloatingRefreshIndicator show label="Reading" />);

    const floated = container.querySelector('.fixed');
    expect(floated).not.toBeNull();
    // Fixed and pinned to a corner: it cannot contribute height to anything.
    expect(floated?.className).toContain('fixed');
    expect(floated?.className).toContain('right-6');
    // It must not swallow clicks on whatever it happens to be sitting over.
    expect(floated?.className).toContain('pointer-events-none');
  });

  it('keeps its element mounted and changes only opacity', () => {
    const { container } = renderInApp(<FloatingRefreshIndicator show={false} label="Reading" />);

    // Present but transparent rather than removed: an element that leaves and
    // rejoins the tree twelve times a minute is announced every time.
    const floated = container.querySelector('.fixed');
    expect(floated).not.toBeNull();
    expect(floated?.className).toContain('opacity-0');
    expect(floated?.getAttribute('aria-hidden')).toBe('true');
    expect(screen.getByRole('status', { hidden: true })).toBeInTheDocument();
  });

  it('says nothing while no refresh is in flight', () => {
    renderInApp(<FloatingRefreshIndicator show={false} label="Reading the daemon" />);

    expect(screen.queryByText('Reading the daemon')).not.toBeInTheDocument();
  });
});
