import { fireEvent, render, screen } from '@testing-library/react';

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

  describe('when collapsible', () => {
    it('folds and unfolds from the heading, and says which it is', () => {
      render(
        <Section title="Shell" collapsible>
          <p>terminal</p>
        </Section>,
      );
      const toggle = screen.getByRole('button', { name: /Shell/ });
      expect(toggle).toHaveAttribute('aria-expanded', 'true');
      expect(screen.getByText('terminal')).toBeInTheDocument();

      fireEvent.click(toggle);
      expect(toggle).toHaveAttribute('aria-expanded', 'false');

      fireEvent.click(toggle);
      expect(screen.getByText('terminal')).toBeInTheDocument();
    });

    // Hiding with CSS would leave a shell connected and a metrics panel polling
    // behind a section the Operator believes they closed.
    it('unmounts the body rather than hiding it', () => {
      render(
        <Section title="Live usage" collapsible>
          <p>polling</p>
        </Section>,
      );
      fireEvent.click(screen.getByRole('button', { name: /Live usage/ }));
      expect(screen.queryByText('polling')).not.toBeInTheDocument();
    });

    it('starts folded when asked, for something long that is rarely wanted', () => {
      render(
        <Section title="Manage" collapsible defaultOpen={false}>
          <p>actions</p>
        </Section>,
      );
      expect(screen.getByRole('button', { name: /Manage/ })).toHaveAttribute(
        'aria-expanded',
        'false',
      );
      expect(screen.queryByText('actions')).not.toBeInTheDocument();
    });

    // A folded section still has to say what is inside it, or folding it away
    // means losing the one number that would have said whether to open it.
    it('shows the summary only while folded', () => {
      render(
        <Section title="Logs" collapsible summary="12 lines" defaultOpen={false}>
          <p>output</p>
        </Section>,
      );
      expect(screen.getByText('12 lines')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: /Logs/ }));
      expect(screen.queryByText('12 lines')).not.toBeInTheDocument();
    });

    // Refreshing something nobody can see is a button that only causes doubt.
    it('folds the action away with the body', () => {
      render(
        <Section title="Logs" collapsible action={<button>Refresh</button>}>
          <p>output</p>
        </Section>,
      );
      fireEvent.click(screen.getByRole('button', { name: /Logs/ }));
      expect(screen.queryByRole('button', { name: 'Refresh' })).not.toBeInTheDocument();
    });

    it('is still a landmark named by its heading', () => {
      render(
        <Section title="Command and environment" collapsible>
          <p>content</p>
        </Section>,
      );
      expect(
        screen.getByRole('region', { name: 'Command and environment' }),
      ).toBeInTheDocument();
    });
  });
});
