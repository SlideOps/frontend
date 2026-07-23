/** Join class name fragments, dropping anything falsy. Token driven styling only. */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}
