import { describe, expect, it } from 'vitest';
import { maskValue } from './components/RevealValue';

describe('maskValue', () => {
  it('returns only mask characters, never the real value', () => {
    const masked = maskValue('super-secret-token');
    expect(masked).toMatch(/^•+$/);
    expect(masked).not.toContain('secret');
  });

  it('keeps a minimum length for short or empty values so nothing collapses', () => {
    expect(maskValue('')).toHaveLength(6);
    expect(maskValue('ab')).toHaveLength(6);
  });

  it('caps the length so it never leaks how long a long value is', () => {
    const short = maskValue('a'.repeat(30));
    const long = maskValue('a'.repeat(500));
    expect(short).toHaveLength(24);
    expect(long).toHaveLength(24);
    expect(short).toEqual(long);
  });
});
