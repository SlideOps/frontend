/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/*
 * The record of what this browser has already put on screen is the only thing
 * standing between the Operator and the same toast forever, so it is tested
 * against a fresh module each time: importing it again is what a reload does,
 * and reading the record back is the whole point of storing it.
 */

const STORAGE_KEY = 'slideops.notifications.shown';

/** The module as a fresh page load gets it, with nothing held in memory. */
async function freshLoad() {
  vi.resetModules();
  return import('./shownToasts');
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('the record of notifications already shown as a toast', () => {
  it('remembers a notification once it has been shown', async () => {
    const { hasToastShown, rememberToastShown } = await freshLoad();

    expect(hasToastShown('op_1:4')).toBe(false);
    rememberToastShown('op_1:4');

    expect(hasToastShown('op_1:4')).toBe(true);
    expect(hasToastShown('op_1:5')).toBe(false);
  });

  it('reads back what an earlier load stored, so a reload does not show it again', async () => {
    const first = await freshLoad();
    first.rememberToastShown('inbox:n1');

    const reloaded = await freshLoad();

    expect(reloaded.hasToastShown('inbox:n1')).toBe(true);
  });

  it('keeps the stored record bounded, forgetting the oldest ids first', async () => {
    const { hasToastShown, rememberToastShown, shownToastLimit } = await freshLoad();
    const overflow = 5;

    for (let i = 0; i < shownToastLimit + overflow; i += 1) {
      rememberToastShown(`op_${i}:1`);
    }

    const stored: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '[]');
    expect(Array.isArray(stored) && stored.length).toBe(shownToastLimit);
    expect(hasToastShown('op_0:1')).toBe(false);
    expect(hasToastShown(`op_${overflow - 1}:1`)).toBe(false);
    expect(hasToastShown(`op_${overflow}:1`)).toBe(true);
    expect(hasToastShown(`op_${shownToastLimit + overflow - 1}:1`)).toBe(true);
  });

  it('ignores a corrupt stored record rather than throwing', async () => {
    window.localStorage.setItem(STORAGE_KEY, 'not json at all');
    const broken = await freshLoad();
    expect(broken.hasToastShown('op_1:4')).toBe(false);

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ id: 'op_1:4' }));
    const wrongShape = await freshLoad();
    expect(wrongShape.hasToastShown('op_1:4')).toBe(false);

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(['op_1:4', 7, null]));
    const partlyWrong = await freshLoad();
    expect(partlyWrong.hasToastShown('op_1:4')).toBe(true);
  });

  it('still remembers for this session when storage cannot be read or written', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage is blocked in this window');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage is blocked in this window');
    });

    const { hasToastShown, rememberToastShown } = await freshLoad();

    expect(hasToastShown('op_1:4')).toBe(false);
    expect(() => rememberToastShown('op_1:4')).not.toThrow();
    expect(hasToastShown('op_1:4')).toBe(true);
  });

  it('forgets everything it has recorded when asked to', async () => {
    const { forgetShownToasts, hasToastShown, rememberToastShown } = await freshLoad();
    rememberToastShown('op_1:4');

    forgetShownToasts();

    expect(hasToastShown('op_1:4')).toBe(false);
  });
});
