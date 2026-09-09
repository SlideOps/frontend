import type { DockerCleanupCategory, DockerImage, DockerVolume } from '@slideops/api-client';
import { formatBytes, formatUptime } from './docker-inventory';

/*
 * How a Node's images, volumes, networks and reclaimable disk read on screen.
 *
 * Pure, for the same reason docker-inventory.ts is pure: the rules about what
 * counts as unused, what "size unknown" looks like, and what a cleanup button
 * is allowed to promise are decisions, and decisions belong somewhere a test
 * can hold them to account rather than scattered through markup.
 *
 * The rule inherited from the inventory runs through every line below: nothing
 * is stated that the daemon did not report. A volume whose size was never read
 * is Unknown and never 0 B. A category with no figure has no figure. An image
 * with no repository is untagged, not an image called "<none>".
 *
 * Nothing here duplicates docker-inventory.ts. formatBytes and formatUptime are
 * imported from it, so one page never quotes two different meanings of "GB".
 */

/* ------------------------------------------------------------------ *
 * Images
 * ------------------------------------------------------------------ */

/**
 * The lenses an Operator reads the image list through.
 *
 * Deliberately overlapping rather than a partition. A dangling image is almost
 * always unused, but not always: a running container can hold an image whose
 * tags a rebuild took away, and that image is both dangling and in use. Forcing
 * the three into exclusive buckets would have to pick one of those facts to
 * hide, and either choice misleads. Overlapping lenses let "unused" mean
 * exactly "nothing is using this" and "dangling" mean exactly "this lost its
 * name", which is what each word means to Docker.
 */
export type ImageLens = 'all' | 'in-use' | 'unused' | 'dangling';

/** The lenses in the order they are offered, with the words for each. */
export const IMAGE_LENSES: readonly { value: ImageLens; label: string }[] = [
  { value: 'all', label: 'Every image' },
  { value: 'in-use', label: 'In use' },
  { value: 'unused', label: 'Unused' },
  { value: 'dangling', label: 'Dangling' },
];

/** Whether one image belongs under one lens. */
export function imageMatchesLens(image: DockerImage, lens: ImageLens): boolean {
  switch (lens) {
    case 'all':
      return true;
    case 'in-use':
      return image.in_use;
    case 'unused':
      return !image.in_use;
    case 'dangling':
      return image.dangling;
  }
}

/** The images under one lens, in the order they arrived. */
export function filterImagesByLens(images: DockerImage[], lens: ImageLens): DockerImage[] {
  return images.filter((image) => imageMatchesLens(image, lens));
}

/**
 * How many images each lens holds, so a picker can say what it would show
 * before it is used. The counts overlap for the same reason the lenses do.
 */
export function countImagesByLens(images: DockerImage[]): Record<ImageLens, number> {
  return {
    all: images.length,
    'in-use': images.filter((image) => image.in_use).length,
    unused: images.filter((image) => !image.in_use).length,
    dangling: images.filter((image) => image.dangling).length,
  };
}

/**
 * What an Operator would call this image.
 *
 * Docker reports a lost repository and tag as the literal string `<none>`, and
 * an image list that shows `<none>:<none>` is showing an Operator a Docker
 * implementation detail and calling it a name. An image with no name is
 * untagged, and its id is the only thing that identifies it.
 */
export function imageReference(image: DockerImage): string {
  const repository = namedOrEmpty(image.repository);
  const tag = namedOrEmpty(image.tag);
  if (!repository) {
    return 'Untagged';
  }
  return tag ? `${repository}:${tag}` : repository;
}

/** Docker's `<none>` placeholder is not a name, so it reads as no name at all. */
function namedOrEmpty(value: string | undefined): string {
  const text = (value ?? '').trim();
  return text === '' || text === '<none>' ? '' : text;
}

/**
 * Free text search across everything an Operator might recognise an image by:
 * its repository, its tag, either together, and its id.
 *
 * An empty query is not a filter. It returns everything, rather than nothing.
 */
export function searchImages(images: DockerImage[], query: string): DockerImage[] {
  const needle = query.trim().toLowerCase();
  if (!needle) {
    return [...images];
  }
  return images.filter((image) =>
    [image.repository, image.tag, imageReference(image), image.id]
      .join('\n')
      .toLowerCase()
      .includes(needle),
  );
}

/**
 * What removing every image nothing is using would release, in bytes.
 *
 * Counted from `in_use` alone. Dangling images are included because a dangling
 * image nothing is using is unused, and a dangling image something is using is
 * not free to remove however untidy it looks.
 *
 * This is a sum of image sizes as the daemon reports them, and images that
 * share layers release less than the sum when they go. Docker's own `system df`
 * accounting is the figure to trust for the exact number, which is why the
 * cleanup centre quotes that instead; a screen showing this one must say it is
 * an upper bound rather than a promise.
 */
export function reclaimableImageBytes(images: DockerImage[]): number {
  return images.reduce((total, image) => (image.in_use ? total : total + image.size_bytes), 0);
}

/**
 * "4.8 GB can be reclaimed", or null when there is nothing to reclaim.
 *
 * Null rather than "0 B can be reclaimed", because a line saying nothing can be
 * reclaimed is a line about housekeeping on a page about images, and the screen
 * simply leaves it out.
 */
export function reclaimableImagesText(images: DockerImage[]): string | null {
  const bytes = reclaimableImageBytes(images);
  if (bytes <= 0) {
    return null;
  }
  return `${formatBytes(bytes)} can be reclaimed`;
}

/* ------------------------------------------------------------------ *
 * Volumes
 * ------------------------------------------------------------------ */

/**
 * A volume's size as something a person reads, or "Unknown".
 *
 * Two ways of not knowing arrive here and both mean the same thing to an
 * Operator: the field is absent because nobody asked the daemon for disk usage,
 * or it is negative because the daemon was asked and could not answer. Neither
 * is zero. A volume rendered as 0 B reads as an empty volume, which is the one
 * thing that makes removing it look safe, and it is exactly the volume most
 * likely to hold a database.
 */
export function volumeSizeText(volume: DockerVolume): string {
  const size = volume.size_bytes;
  if (typeof size !== 'number' || !Number.isFinite(size) || size < 0) {
    return 'Unknown';
  }
  return formatBytes(size);
}

/** Free text search over a volume's name, driver, mountpoint and labels. */
export function searchVolumes(volumes: DockerVolume[], query: string): DockerVolume[] {
  const needle = query.trim().toLowerCase();
  if (!needle) {
    return [...volumes];
  }
  return volumes.filter((volume) =>
    [volume.name, volume.driver, volume.mountpoint, ...Object.entries(volume.labels).flat()]
      .join('\n')
      .toLowerCase()
      .includes(needle),
  );
}

/* ------------------------------------------------------------------ *
 * Networks
 * ------------------------------------------------------------------ */

/**
 * The three networks Docker creates for itself and will not let anyone remove.
 *
 * A screen knows this before it asks. Offering a Remove control on `bridge`
 * that fails on the click teaches an Operator that the controls on this page
 * are guesses; showing plainly that these three are Docker's own teaches them
 * something true about their server.
 */
export const PROTECTED_NETWORK_NAMES: readonly string[] = ['bridge', 'host', 'none'];

/** Whether this is one of Docker's own networks, and so never removable. */
export function isProtectedNetworkName(name: string): boolean {
  return PROTECTED_NETWORK_NAMES.includes(name);
}

/* ------------------------------------------------------------------ *
 * Cleanup
 * ------------------------------------------------------------------ */

/**
 * Whether a category holds the Operator's own data rather than Docker's
 * leftovers.
 *
 * Everything else a cleanup releases can be rebuilt: an image comes back from a
 * registry, a build cache rebuilds itself, a stopped container was already
 * finished. A volume is the database, and "unused" means only that no container
 * has it open at this instant, which is also true of every volume belonging to
 * a service that is currently stopped.
 *
 * Matched on the key containing "volume" rather than on an exact key, because
 * the backend names its own categories and this must fail towards asking for
 * consent. A new volume category that this did not recognise would be released
 * on a single click, which is the one outcome worth writing a loose match for.
 */
export function categoryHoldsData(category: DockerCleanupCategory): boolean {
  return category.key.toLowerCase().includes('volume');
}

/**
 * What one category's button says it will do: "Remove 7 stopped containers,
 * reclaim 1.2 GB".
 *
 * The count and the figure are both in the label because they are the two
 * things that decide whether to press it, and a button reading only "Remove"
 * asks somebody to trust that the row above it still describes what is about to
 * happen.
 *
 * A category with nothing in it says so instead of offering an action that
 * would do nothing.
 */
export function cleanupActionLabel(category: DockerCleanupCategory): string {
  if (category.count <= 0) {
    return 'Nothing to remove';
  }
  const what = `${category.count} ${countedLabel(category.label, category.count)}`;
  if (category.reclaimable_bytes > 0) {
    return `Remove ${what}, reclaim ${formatBytes(category.reclaimable_bytes)}`;
  }
  // No figure means the daemon reported none. The action is still worth
  // offering; promising a reclaim of 0 B is not.
  return `Remove ${what}`;
}

/**
 * The daemon's own label for a category, put into a sentence.
 *
 * Lowercased so it reads inside "Remove 7 ...", except where the label starts
 * with something that is capitalised in its own right, which lowercasing would
 * damage. Singularised by dropping a trailing "s" for a count of one, which is
 * a crude rule that is right for every category Docker actually reports
 * (containers, images, volumes, networks) and harmless where it is not.
 */
function countedLabel(label: string, count: number): string {
  const text = label.trim();
  const lowered = /^[A-Z][a-z]/.test(text) ? text[0]!.toLowerCase() + text.slice(1) : text;
  if (count === 1 && lowered.endsWith('s')) {
    return lowered.slice(0, -1);
  }
  return lowered;
}

/** What every category adds up to. */
export interface ReclaimableSummary {
  /** Everything the categories say could be released, in bytes. */
  totalBytes: number;
  /** How many things would be removed in total. */
  totalCount: number;
  /** How many categories actually have something in them. */
  activeCategories: number;
  /** "4.8 GB can be reclaimed", or null when there is nothing to reclaim. */
  text: string | null;
}

/**
 * Add up what a cleanup preview offers.
 *
 * A total, not a button. Every category is released separately and on its own
 * terms, so this figure exists to answer "is it worth looking at this page",
 * and it must never grow a control that acts on all of it at once: the reason
 * unused volumes are a separate decision does not stop being true when their
 * bytes are added to somebody else's.
 */
export function reclaimableSummary(categories: DockerCleanupCategory[]): ReclaimableSummary {
  let totalBytes = 0;
  let totalCount = 0;
  let activeCategories = 0;
  for (const category of categories) {
    // A negative figure is a daemon that could not answer, not disk owed back.
    totalBytes += Math.max(0, category.reclaimable_bytes);
    totalCount += Math.max(0, category.count);
    if (category.count > 0) {
      activeCategories += 1;
    }
  }
  return {
    totalBytes,
    totalCount,
    activeCategories,
    text: totalBytes > 0 ? `${formatBytes(totalBytes)} can be reclaimed` : null,
  };
}

/* ------------------------------------------------------------------ *
 * Shared formatting
 * ------------------------------------------------------------------ */

/**
 * How long ago something was created, as "3d 4h ago", or "Unknown".
 *
 * An age rather than a date, because the question an Operator asks of an image
 * or a volume is how old it is, not which Tuesday it appeared. It reuses
 * formatUptime so an age on this page and an uptime on the container page are
 * written the same way.
 *
 * A timestamp that will not parse is Unknown, and a timestamp in the future is
 * clock skew between this browser and the server rather than something created
 * later, so it reads as brand new.
 */
export function formatAge(iso: string | undefined, now: Date = new Date()): string {
  if (!iso) {
    return 'Unknown';
  }
  const created = Date.parse(iso);
  if (Number.isNaN(created)) {
    return 'Unknown';
  }
  const seconds = Math.max(0, Math.floor((now.getTime() - created) / 1000));
  return `${formatUptime(seconds)} ago`;
}

/**
 * A list of container names as a sentence: "web, api and db".
 *
 * Empty is "None", which is a real answer for a volume nothing has mounted and
 * a network nothing has joined, and is the answer that decides whether removing
 * it is safe.
 */
export function containersText(names: string[]): string {
  const named = names.filter((name) => name.trim() !== '');
  if (named.length === 0) {
    return 'None';
  }
  if (named.length === 1) {
    return named[0]!;
  }
  return `${named.slice(0, -1).join(', ')} and ${named[named.length - 1]}`;
}

/* ------------------------------------------------------------------ *
 * Inspect
 * ------------------------------------------------------------------ */

/** One labelled fact from a daemon record. `value` is always readable text. */
export interface InspectEntry {
  label: string;
  value: string;
}

/**
 * How deep a record is walked before what is left is shown as it came.
 *
 * Docker's own inspect records for these three are two or three levels at most.
 * Anything deeper is a driver's private structure, and a label built from six
 * joined keys is less readable than the JSON it was made from.
 */
const MAX_INSPECT_DEPTH = 4;

/**
 * A daemon record flattened into labelled rows, in the order the daemon sent
 * them.
 *
 * The shape of an image, volume or network inspect varies with the driver in
 * use, so there is no fixed set of sections to render it into and pretending
 * otherwise would drop whatever a Node's driver reported that we had not
 * anticipated. Flattening keeps everything and states nothing extra.
 *
 * Absent values are dropped rather than rendered: a key whose value is null, an
 * empty string, an empty list or an empty object is a key the daemon had no
 * answer for, and a row reading "Options: " says less than no row at all.
 */
export function inspectEntries(inspect: unknown, depth = 0): InspectEntry[] {
  if (!inspect || typeof inspect !== 'object' || Array.isArray(inspect)) {
    return [];
  }
  const entries: InspectEntry[] = [];
  for (const [key, value] of Object.entries(inspect as Record<string, unknown>)) {
    if (isAbsent(value)) {
      continue;
    }
    if (isPlainRecord(value) && depth < MAX_INSPECT_DEPTH) {
      for (const nested of inspectEntries(value, depth + 1)) {
        entries.push({ label: `${key}.${nested.label}`, value: nested.value });
      }
      continue;
    }
    entries.push({ label: key, value: readableValue(value) });
  }
  return entries;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isAbsent(value: unknown): boolean {
  if (value === null || value === undefined) {
    return true;
  }
  if (typeof value === 'string' && value.trim() === '') {
    return true;
  }
  if (Array.isArray(value)) {
    return value.length === 0;
  }
  if (isPlainRecord(value)) {
    return Object.keys(value).length === 0;
  }
  return false;
}

function readableValue(value: unknown): string {
  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }
  if (typeof value === 'string' || typeof value === 'number') {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.map((entry) => readableValue(entry)).join(', ');
  }
  // A record too deep to flatten, shown as it arrived rather than summarised
  // into something that was never in the daemon's answer.
  return JSON.stringify(value);
}
