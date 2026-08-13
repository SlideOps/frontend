import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
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
    el.style.setProperty('--color-brand', '#3b5bdb');
    expect(readCssVar('--color-brand', el)).toBe('#3b5bdb');
    expect(chartColorFromToken('--color-brand', el)).toBe('#3b5bdb');
  });

  it('falls back to the documented value when the token is unset', () => {
    const el = document.createElement('div');
    expect(readCssVar('--color-brand', el)).toBe('');
    expect(chartColorFromToken('--color-brand', el)).toBe('#3b5bdb');
  });

  it('resolves a full palette with a distinct ordered series', () => {
    const el = document.createElement('div');
    el.style.setProperty('--color-brand', '#3b5bdb');
    el.style.setProperty('--color-info', '#3b82c4');
    el.style.setProperty('--color-success', '#2f9e5b');
    const palette = resolveChartPalette(el);
    expect(palette.brand).toBe('#3b5bdb');
    expect(palette.series[0]).toBe('#3b5bdb');
    expect(palette.series[1]).toBe('#3b82c4');
    expect(palette.series.length).toBeGreaterThan(2);
  });
});

/*
 * TOKEN_FALLBACK is a hand-maintained mirror of tokens.css's light theme block,
 * kept only for the non-browser case chart.ts documents. Nothing enforces the
 * two stay in sync except this test: without it, a future palette repaint that
 * only touches tokens.css leaves the fallback silently stale, and a
 * server-rendered or tested chart quietly reverts to the old palette.
 */
describe('TOKEN_FALLBACK stays in sync with tokens.css', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const css = readFileSync(join(here, '../styles/tokens.css'), 'utf-8');

  // The light theme block is the first `:root, :root[data-theme='light'] { ... }`
  // rule in the file; extract just its body so a var(--so-*) reference can be
  // resolved against the primitives declared above it in the same file.
  const lightBlockMatch = css.match(/:root,\s*:root\[data-theme='light'\]\s*{([^}]*)}/);
  const lightBlockBody = lightBlockMatch?.[1];
  if (lightBlockBody === undefined) {
    throw new Error('tokens.css light theme block not found; did its selector change?');
  }
  const lightBlock = lightBlockBody;

  function resolvedLightValue(token: string): string {
    const declared = lightBlock.match(new RegExp(`${token}:\\s*([^;]+);`))?.[1];
    if (declared === undefined) {
      throw new Error(`${token} is not declared in the light theme block`);
    }
    const raw = declared.trim();
    const varRef = raw.match(/^var\((--so-[a-z0-9-]+)\)$/)?.[1];
    if (varRef === undefined) {
      return raw;
    }
    const primitive = css.match(new RegExp(`${varRef}:\\s*([^;]+);`))?.[1];
    if (primitive === undefined) {
      throw new Error(`primitive ${varRef} referenced by ${token} is not declared`);
    }
    return primitive.trim();
  }

  const fallbackTokens = [
    '--color-brand',
    '--color-accent',
    '--color-highlight',
    '--color-text-primary',
    '--color-text-secondary',
    '--color-text-on-brand',
    '--color-border',
    '--color-success',
    '--color-warning',
    '--color-danger',
    '--color-info',
  ];

  it.each(fallbackTokens)('%s matches the light theme value in tokens.css', (token) => {
    const el = document.createElement('div');
    expect(chartColorFromToken(token, el)).toBe(resolvedLightValue(token));
  });
});
