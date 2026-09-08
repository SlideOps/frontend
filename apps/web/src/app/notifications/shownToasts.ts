/*
 * Which notifications this browser has already popped up as a toast.
 *
 * Deliberately not the same question as read. Read is the Operator's own state:
 * it drives the unread badge and, for a notification the durable backend inbox
 * owns, it is persisted server side. Shown is this browser's memory of having
 * already put the thing on screen once, which is all the toaster needs to know.
 *
 * Keeping them apart matters in both directions. A toast that appeared and
 * timed out on its own has been shown but has not been read, so marking it read
 * would silently clear the unread badge for something nobody looked at. And a
 * notification that lives only in the live event stream has read state that
 * exists in memory only, so after a reload it is unread again: without a record
 * of its own, the toaster had nothing left to stop it popping up forever, on
 * every load, for the rest of time.
 *
 * The record is per browser on purpose. It answers "did this screen already
 * show this", and a different browser has genuinely never shown it.
 */

/** Where this browser keeps the record. */
const STORAGE_KEY = 'slideops.notifications.shown';

/**
 * How many ids are kept. Notifications are capped at 50 in the store and are
 * toasted once each, so a few hundred covers a long session with room to spare
 * while keeping the stored value small. The oldest are evicted first: an id old
 * enough to fall out is one whose notification is long gone from the feed.
 */
const MAX_REMEMBERED = 300;

/*
 * The in-memory copy, so a remount within one page load is answered without
 * touching storage, and so the toaster still behaves when storage is denied:
 * the ids simply live for this session instead of surviving the reload.
 */
let remembered: string[] | null = null;

/** This browser's record, or an empty one. Never throws: storage can be denied. */
function readStored(): string[] {
  if (typeof window === 'undefined') {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    // Anything that is not a string was not written by this module, so the
    // stored value is treated as partly corrupt rather than trusted whole.
    const ids = parsed.filter((id): id is string => typeof id === 'string');
    return ids.slice(-MAX_REMEMBERED);
  } catch {
    // Unparseable, or storage refused outright in a private window.
    return [];
  }
}

/** Keep this browser's record current. A refusal to store is not worth reporting. */
function persist(ids: string[]): void {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // Storage can be full or blocked. The in-memory copy still holds for this
    // session, so nothing toasts twice before the next reload.
  }
}

function loaded(): string[] {
  if (remembered === null) {
    remembered = readStored();
  }
  return remembered;
}

/** Whether this browser has already put the given notification on screen. */
export function hasToastShown(id: string): boolean {
  return loaded().includes(id);
}

/** Record that the given notification has been put on screen as a toast. */
export function rememberToastShown(id: string): void {
  const ids = loaded();
  if (ids.includes(id)) {
    return;
  }
  ids.push(id);
  if (ids.length > MAX_REMEMBERED) {
    ids.splice(0, ids.length - MAX_REMEMBERED);
  }
  persist(ids);
}

/** Forget the record, both in memory and in storage. */
export function forgetShownToasts(): void {
  remembered = [];
  persist([]);
}

/** The cap the record is held to, so a caller can state it without repeating it. */
export const shownToastLimit = MAX_REMEMBERED;
