import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Section } from './Section';

/*
 * Section replaced Card for every page section, so it carries most of the
 * interface now. What is worth pinning is that it is a landmark with a real
 * heading, since that is what a screen reader navigates by and what a sighted
 * reader scans by, and that it separates without drawing a box.
 */

describe('Section', () => {
  it('is a landmark named by its heading, so it can be navigated to', () => {
    render(
      <Section title="Discovery">
        <p>content</p>
      </Section>,
    );
    const section = screen.getByRole('region', { name: 'Discovery' });
    expect(section).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Discovery' })).toBeInTheDocument();
  });

  it('carries the description and the action beside the heading', () => {
    render(
      <Section
        title="Logs"
        description="The last of what it printed."
        action={<button>Refresh</button>}
      >
        <p>content</p>
      </Section>,
    );
    expect(screen.getByText('The last of what it printed.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeInTheDocument();
  });

  // The separation is a hairline above, not a border all the way round: a box is
  // what this exists to stop drawing.
  it('separates with a rule above rather than a box around', () => {
    const { container } = render(
      <Section title="Second">
        <p>content</p>
      </Section>,
    );
    const section = container.querySelector('section');
    expect(section?.className).toContain('border-t');
    expect(section?.className).not.toContain('rounded');
    expect(section?.className).not.toContain('shadow');
  });

  // The first section on a page has nothing above it to be separated from, and a
  // rule there would read as the end of something that never began.
  it('drops the rule when it is the first on a page', () => {
    const { container } = render(
      <Section title="First" flush>
        <p>content</p>
      </Section>,
    );
    expect(container.querySelector('section')?.className).not.toContain('border-t');
  });
});
