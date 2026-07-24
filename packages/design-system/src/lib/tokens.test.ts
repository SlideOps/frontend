import { describe, expect, it } from 'vitest';
import { chartColorFromToken, readCssVar, resolveChartPalette } from './tokens';

/*
 * The chart color helper reads resolved token values from the document so charts
 * follow the active theme. Here we set the tokens on a probe element and assert
 * the helper reads them back, and that a missing token resolves to its
 * documented fallback rather than an empty string.
 */

describe('chart color from token', () => {
  it('reads a token value set on an element', () => {
    const el = document.createElement('div');
    el.style.setProperty('--color-brand', '#743930');
    expect(readCssVar('--color-brand', el)).toBe('#743930');
    expect(chartColorFromToken('--color-brand', el)).toBe('#743930');
  });

  it('falls back to the documented value when the token is unset', () => {
    const el = document.createElement('div');
    expect(readCssVar('--color-brand', el)).toBe('');
    expect(chartColorFromToken('--color-brand', el)).toBe('#743930');
  });

  it('resolves a full palette with a distinct ordered series', () => {
    const el = document.createElement('div');
    el.style.setProperty('--color-brand', '#743930');
    el.style.setProperty('--color-info', '#3d7a8c');
    el.style.setProperty('--color-success', '#5b8c6e');
    const palette = resolveChartPalette(el);
    expect(palette.brand).toBe('#743930');
    expect(palette.series[0]).toBe('#743930');
    expect(palette.series[1]).toBe('#3d7a8c');
    expect(palette.series.length).toBeGreaterThan(2);
  });
});
