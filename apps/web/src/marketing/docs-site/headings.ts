/*
 * Reading the headings out of a page's markdown.
 *
 * Two things need the same answer and must never disagree: the on this page
 * table of contents, and the anchor id the rendered heading actually carries.
 * Both are computed here from the source, and both key off the line the heading
 * sits on. Keying off the line rather than off a running counter is what keeps a
 * page with two headings of the same wording giving each its own stable anchor,
 * however many times React re-renders it.
 */

/** One heading found in a page. */
export interface DocHeading {
  /** The anchor id, stable for as long as the wording and its position hold. */
  readonly id: string;
  /** The heading as written, with its markdown emphasis removed. */
  readonly text: string;
  /** 2 or 3. Deeper headings are structure inside a section, not entries. */
  readonly level: 2 | 3;
  /** The 1-based source line, which is how a rendered heading finds its id. */
  readonly line: number;
}

const FENCE = /^\s{0,3}(```|~~~)/;
const HEADING = /^(#{2,3})\s+(.+?)\s*#*\s*$/;

/** Strip the markdown a heading may carry so the anchor reads as words. */
function plainText(raw: string): string {
  return raw
    .replace(/`([^`]*)`/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[*_]{1,3}([^*_]+)[*_]{1,3}/g, '$1')
    .trim();
}

/** Turn heading text into a url fragment: lowercase words joined by hyphens. */
export function slugifyHeading(text: string): string {
  const slug = text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  // A heading of nothing but punctuation would otherwise produce an empty
  // fragment, which no browser can scroll to.
  return slug.length > 0 ? slug : 'section';
}

/**
 * Every h2 and h3 in a page, in document order, each with the anchor it will
 * carry. Headings inside fenced code blocks are comments in someone's example,
 * not headings, so they are skipped.
 */
export function readHeadings(markdown: string): DocHeading[] {
  const headings: DocHeading[] = [];
  const used = new Map<string, number>();
  let inFence = false;

  markdown.split('\n').forEach((rawLine, index) => {
    if (FENCE.test(rawLine)) {
      inFence = !inFence;
      return;
    }
    if (inFence) return;

    const match = HEADING.exec(rawLine);
    if (!match) return;

    const level = match[1]!.length === 2 ? 2 : 3;
    const text = plainText(match[2]!);
    const base = slugifyHeading(text);
    const seen = used.get(base) ?? 0;
    used.set(base, seen + 1);

    headings.push({
      id: seen === 0 ? base : `${base}-${seen + 1}`,
      text,
      level,
      line: index + 1,
    });
  });

  return headings;
}

/** The anchor for each heading, looked up by the source line it starts on. */
export function headingIdsByLine(headings: readonly DocHeading[]): Map<number, string> {
  return new Map(headings.map((heading) => [heading.line, heading.id]));
}
