import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/*
 * The patterns that make a phone scroll sideways.
 *
 * These are invisible on the screen they are written on. A fixed first column of
 * ten rems looks considered on a laptop and leaves a UUID about a hundred pixels
 * on a phone, so the value either wraps into a ragged column or pushes the whole
 * page wider than the screen. Nobody notices until somebody opens it on a phone
 * and the page slides under their thumb.
 *
 * So they are caught here instead. This is a lint rule that happens to be a
 * test: it reads the source rather than rendering anything, because what is
 * wrong is the class name, not the behaviour.
 */

const SOURCE = join(__dirname);

function tsxFiles(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      if (entry === 'node_modules' || entry === 'dist') continue;
      found.push(...tsxFiles(path));
    } else if (entry.endsWith('.tsx') && !entry.endsWith('.test.tsx')) {
      found.push(path);
    }
  }
  return found;
}

/** Every class attribute in a file, so a rule can look at one at a time. */
function classAttributes(source: string): string[] {
  return [...source.matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\})/g)].map(
    (m) => m[1] ?? m[2] ?? '',
  );
}

const files = tsxFiles(SOURCE);

describe('nothing forces a phone to scroll sideways', () => {
  it('finds the source to check', () => {
    expect(files.length).toBeGreaterThan(20);
  });

  /*
   * A fixed grid column has to say what it does on a small screen. Without a
   * breakpoint prefix it applies at every width, including the narrowest.
   */
  it('has no fixed grid column without a breakpoint', () => {
    const offenders: string[] = [];
    for (const file of files) {
      for (const attr of classAttributes(readFileSync(file, 'utf8'))) {
        // A bare grid-cols-[...] with no responsive prefix in front of it.
        if (/(^|\s)grid-cols-\[/.test(attr)) {
          offenders.push(`${file.replace(SOURCE, '')}: ${attr.slice(0, 80)}`);
        }
      }
    }
    expect(offenders, offenders.join('\n')).toEqual([]);
  });

  /*
   * The same for a minimum width. min-w-[14rem] on two siblings with a gap does
   * not fit a 360px screen, and a minimum is precisely the thing that cannot
   * shrink to make it fit.
   */
  it('has no fixed minimum width without a breakpoint, outside a table', () => {
    const offenders: string[] = [];
    for (const file of files) {
      if (file.includes('/marketing/')) continue; // Art directed, checked by eye.
      for (const attr of classAttributes(readFileSync(file, 'utf8'))) {
        if (!/(^|\s)min-w-\[/.test(attr)) continue;
        // A table is the one place a minimum width is right: it keeps columns
        // legible and lets the wrapper scroll, rather than squashing six columns
        // into a phone. That case is covered by the next test instead.
        if (attr.includes('border-collapse')) continue;
        offenders.push(`${file.replace(SOURCE, '')}: ${attr.slice(0, 80)}`);
      }
    }
    expect(offenders, offenders.join('\n')).toEqual([]);
  });

  /*
   * vh is the viewport with the browser chrome at its largest, so a page sized
   * in vh grows and shrinks as the address bar hides and shows. That is the
   * sliding and jumping that makes a web app feel unlike a native one, and dvh
   * follows the viewport that is actually visible.
   */
  it('sizes full height layouts with dvh rather than vh', () => {
    const offenders: string[] = [];
    for (const file of files) {
      for (const attr of classAttributes(readFileSync(file, 'utf8'))) {
        if (/(^|\s)(min-)?h-screen(\s|$)/.test(attr)) {
          offenders.push(`${file.replace(SOURCE, '')}: ${attr.slice(0, 60)}`);
        }
      }
    }
    expect(offenders, offenders.join('\n')).toEqual([]);
  });

  /*
   * A wide table is fine. A wide table with nothing to scroll it is what pushes
   * the page sideways, and the two look identical until somebody opens a phone.
   */
  it('keeps every wide table inside something that scrolls', () => {
    const offenders: string[] = [];
    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      const wideTable = classAttributes(source).some(
        (attr) => attr.includes('border-collapse') && /min-w-/.test(attr),
      );
      if (wideTable && !source.includes('overflow-x-auto')) {
        offenders.push(file.replace(SOURCE, ''));
      }
    }
    expect(offenders, offenders.join('\n')).toEqual([]);
  });
});
