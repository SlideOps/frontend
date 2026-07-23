import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Button } from './Button';

describe('Button', () => {
  it('renders its label and defaults to a non-submitting button', () => {
    render(<Button>Approve plan</Button>);
    const button = screen.getByRole('button', { name: 'Approve plan' });
    expect(button).toBeDefined();
    expect(button.getAttribute('type')).toBe('button');
  });

  it('applies token driven brand styling for the primary variant', () => {
    render(<Button variant="primary">Run</Button>);
    const button = screen.getByRole('button', { name: 'Run' });
    expect(button.className).toContain('bg-brand');
  });
});
