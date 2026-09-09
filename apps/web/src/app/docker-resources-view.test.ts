import type { DockerCleanupCategory, DockerImage, DockerVolume } from '@slideops/api-client';
import { describe, expect, it } from 'vitest';
import {
  categoryHoldsData,
  cleanupActionLabel,
  containersText,
  countImagesByLens,
  filterImagesByLens,
  formatAge,
  imageMatchesLens,
  imageReference,
  inspectEntries,
  isProtectedNetworkName,
  reclaimableImageBytes,
  reclaimableImagesText,
  reclaimableSummary,
  searchImages,
  searchVolumes,
  volumeSizeText,
} from './docker-resources-view';

/*
 * What is worth pinning here is every place the screen could state something
 * nobody established: a volume of unknown size shown as empty, a dangling image
 * counted as reclaimable while a container is still holding it, a cleanup
 * button promising bytes the daemon never reported.
 */

function image(overrides: Partial<DockerImage> = {}): DockerImage {
  return {
    id: 'sha256:1111',
    repository: 'nginx',
    tag: 'latest',
    created_at: '2026-09-01T00:00:00Z',
    size_bytes: 100,
    dangling: false,
    in_use: false,
    containers: 0,
    ...overrides,
  };
}

function volume(overrides: Partial<DockerVolume> = {}): DockerVolume {
  return {
    name: 'app-data',
    driver: 'local',
    mountpoint: '/var/lib/docker/volumes/app-data/_data',
    in_use: false,
    containers: [],
    labels: {},
    ...overrides,
  };
}

function category(overrides: Partial<DockerCleanupCategory> = {}): DockerCleanupCategory {
  return { key: 'stopped_containers', label: 'Stopped containers', count: 0, reclaimable_bytes: 0, ...overrides };
}

describe('reading an image', () => {
  it('names an image by repository and tag', () => {
    expect(imageReference(image({ repository: 'nginx', tag: '1.27' }))).toBe('nginx:1.27');
  });

  it('calls an image with no name untagged rather than showing Docker\'s <none>', () => {
    expect(imageReference(image({ repository: '<none>', tag: '<none>' }))).toBe('Untagged');
    expect(imageReference(image({ repository: '', tag: '' }))).toBe('Untagged');
  });

  it('shows a repository with no tag as the repository alone', () => {
    expect(imageReference(image({ repository: 'internal/web', tag: '<none>' }))).toBe('internal/web');
  });
});

describe('the image lenses', () => {
  const inUse = image({ id: 'a', in_use: true });
  const unused = image({ id: 'b', in_use: false });
  const danglingInUse = image({ id: 'c', in_use: true, dangling: true });
  const danglingUnused = image({ id: 'd', in_use: false, dangling: true });
  const all = [inUse, unused, danglingInUse, danglingUnused];

  it('shows everything under the all lens', () => {
    expect(filterImagesByLens(all, 'all')).toHaveLength(4);
  });

  it('separates in use from unused on in_use alone', () => {
    expect(filterImagesByLens(all, 'in-use').map((i) => i.id)).toEqual(['a', 'c']);
    expect(filterImagesByLens(all, 'unused').map((i) => i.id)).toEqual(['b', 'd']);
  });

  it('keeps a dangling image that is still in use under both dangling and in use', () => {
    // The two facts are independent, and hiding either would mislead: this
    // image lost its name and is still being held by a running container.
    expect(imageMatchesLens(danglingInUse, 'dangling')).toBe(true);
    expect(imageMatchesLens(danglingInUse, 'in-use')).toBe(true);
    expect(imageMatchesLens(danglingInUse, 'unused')).toBe(false);
  });

  it('counts each lens, overlaps included', () => {
    expect(countImagesByLens(all)).toEqual({ all: 4, 'in-use': 2, unused: 2, dangling: 2 });
  });
});

describe('searching images', () => {
  const images = [
    image({ id: 'sha256:aaa', repository: 'nginx', tag: 'latest' }),
    image({ id: 'sha256:bbb', repository: 'postgres', tag: '16' }),
  ];

  it('returns everything for an empty query rather than nothing', () => {
    expect(searchImages(images, '   ')).toHaveLength(2);
  });

  it('matches repository, tag and id', () => {
    expect(searchImages(images, 'postg').map((i) => i.id)).toEqual(['sha256:bbb']);
    expect(searchImages(images, 'LATEST').map((i) => i.id)).toEqual(['sha256:aaa']);
    expect(searchImages(images, 'bbb').map((i) => i.id)).toEqual(['sha256:bbb']);
  });
});

describe('what images could release', () => {
  it('counts only the images nothing is using', () => {
    const images = [
      image({ in_use: true, size_bytes: 1000 }),
      image({ in_use: false, size_bytes: 300 }),
      image({ in_use: false, dangling: true, size_bytes: 200 }),
    ];

    expect(reclaimableImageBytes(images)).toBe(500);
  });

  it('does not count a dangling image a container is still holding', () => {
    expect(reclaimableImageBytes([image({ in_use: true, dangling: true, size_bytes: 900 })])).toBe(0);
  });

  it('phrases the figure for the Operator', () => {
    expect(reclaimableImagesText([image({ in_use: false, size_bytes: 5 * 1024 * 1024 * 1024 })])).toBe(
      '5.0 GB can be reclaimed',
    );
  });

  it('says nothing at all when there is nothing to reclaim', () => {
    expect(reclaimableImagesText([image({ in_use: true, size_bytes: 900 })])).toBeNull();
    expect(reclaimableImagesText([])).toBeNull();
  });
});

describe('a volume size', () => {
  it('reads a size the daemon reported', () => {
    expect(volumeSizeText(volume({ size_bytes: 1024 }))).toBe('1.0 KB');
  });

  it('is Unknown when the daemon was never asked, never 0 B', () => {
    expect(volumeSizeText(volume({ size_bytes: undefined }))).toBe('Unknown');
  });

  it('is Unknown when the daemon answered -1', () => {
    // A volume shown as 0 B reads as an empty volume, which is the one thing
    // that makes removing a database look safe.
    expect(volumeSizeText(volume({ size_bytes: -1 }))).toBe('Unknown');
  });

  it('reports a genuine zero as zero', () => {
    expect(volumeSizeText(volume({ size_bytes: 0 }))).toBe('0 B');
  });
});

describe('searching volumes', () => {
  it('matches name, driver, mountpoint and labels', () => {
    const volumes = [
      volume({ name: 'app-data', labels: { owner: 'platform' } }),
      volume({ name: 'cache', mountpoint: '/mnt/fast/cache' }),
    ];

    expect(searchVolumes(volumes, 'platform').map((v) => v.name)).toEqual(['app-data']);
    expect(searchVolumes(volumes, '/mnt/fast').map((v) => v.name)).toEqual(['cache']);
    expect(searchVolumes(volumes, '')).toHaveLength(2);
  });
});

describe('Docker\'s own networks', () => {
  it('knows the three that can never be removed', () => {
    expect(isProtectedNetworkName('bridge')).toBe(true);
    expect(isProtectedNetworkName('host')).toBe(true);
    expect(isProtectedNetworkName('none')).toBe(true);
  });

  it('treats every other network as the Operator\'s own', () => {
    expect(isProtectedNetworkName('backend')).toBe(false);
    expect(isProtectedNetworkName('bridge-2')).toBe(false);
  });
});

describe('the cleanup categories', () => {
  it('says what a button would do, with the count and the figure', () => {
    expect(
      cleanupActionLabel(category({ label: 'Stopped containers', count: 7, reclaimable_bytes: 1_288_490_188 })),
    ).toBe('Remove 7 stopped containers, reclaim 1.2 GB');
  });

  it('reads singular for one', () => {
    expect(cleanupActionLabel(category({ label: 'Unused volumes', count: 1, reclaimable_bytes: 1024 }))).toBe(
      'Remove 1 unused volume, reclaim 1.0 KB',
    );
  });

  it('promises no reclaim when the daemon reported no figure', () => {
    expect(cleanupActionLabel(category({ label: 'Unused networks', count: 3, reclaimable_bytes: 0 }))).toBe(
      'Remove 3 unused networks',
    );
  });

  it('offers nothing for an empty category', () => {
    expect(cleanupActionLabel(category({ count: 0 }))).toBe('Nothing to remove');
  });

  it('recognises every volume category as one that holds data', () => {
    expect(categoryHoldsData(category({ key: 'unused_volumes' }))).toBe(true);
    expect(categoryHoldsData(category({ key: 'volumes' }))).toBe(true);
    // A category the backend adds later still asks for consent, because this
    // fails towards asking rather than towards deleting.
    expect(categoryHoldsData(category({ key: 'anonymous_volume_data' }))).toBe(true);
    expect(categoryHoldsData(category({ key: 'dangling_images' }))).toBe(false);
    expect(categoryHoldsData(category({ key: 'build_cache' }))).toBe(false);
  });
});

describe('adding the categories up', () => {
  it('totals the bytes, the things, and the categories that have any', () => {
    const summary = reclaimableSummary([
      category({ key: 'stopped_containers', count: 7, reclaimable_bytes: 1_073_741_824 }),
      category({ key: 'unused_networks', count: 2, reclaimable_bytes: 0 }),
      category({ key: 'build_cache', count: 0, reclaimable_bytes: 0 }),
    ]);

    expect(summary.totalBytes).toBe(1_073_741_824);
    expect(summary.totalCount).toBe(9);
    expect(summary.activeCategories).toBe(2);
    expect(summary.text).toBe('1.0 GB can be reclaimed');
  });

  it('says nothing when nothing can be reclaimed', () => {
    expect(reclaimableSummary([]).text).toBeNull();
    expect(reclaimableSummary([category({ count: 4, reclaimable_bytes: 0 })]).text).toBeNull();
  });

  it('never turns a negative figure into disk owed back', () => {
    expect(reclaimableSummary([category({ count: -1, reclaimable_bytes: -500 })]).totalBytes).toBe(0);
  });
});

describe('formatting shared by the three panels', () => {
  const now = new Date('2026-09-08T12:00:00Z');

  it('reads a creation time as an age', () => {
    expect(formatAge('2026-09-05T08:00:00Z', now)).toBe('3d 4h ago');
  });

  it('is Unknown for a missing or unreadable timestamp, never a date of zero', () => {
    expect(formatAge(undefined, now)).toBe('Unknown');
    expect(formatAge('not a date', now)).toBe('Unknown');
  });

  it('treats a future timestamp as clock skew rather than a future creation', () => {
    expect(formatAge('2026-09-09T12:00:00Z', now)).toBe('0s ago');
  });

  it('lists container names as a sentence, and says None for an empty list', () => {
    expect(containersText([])).toBe('None');
    expect(containersText(['web'])).toBe('web');
    expect(containersText(['web', 'api'])).toBe('web and api');
    expect(containersText(['web', 'api', 'db'])).toBe('web, api and db');
  });
});

describe('flattening a daemon record for the inspect panel', () => {
  it('keeps every key the daemon sent, nesting into dotted labels', () => {
    const entries = inspectEntries({
      Name: 'app-data',
      Options: { device: '/dev/sdb', type: 'ext4' },
      Mountpoint: '/var/lib/docker/volumes/app-data/_data',
    });

    expect(entries).toEqual([
      { label: 'Name', value: 'app-data' },
      { label: 'Options.device', value: '/dev/sdb' },
      { label: 'Options.type', value: 'ext4' },
      { label: 'Mountpoint', value: '/var/lib/docker/volumes/app-data/_data' },
    ]);
  });

  it('drops the keys the daemon had no answer for', () => {
    expect(
      inspectEntries({ Name: 'net', Labels: {}, Options: null, Aliases: [], Gateway: '   ' }),
    ).toEqual([{ label: 'Name', value: 'net' }]);
  });

  it('reads booleans and lists the way a person would', () => {
    expect(inspectEntries({ Internal: true, Attachable: false, RepoTags: ['a:1', 'b:2'] })).toEqual([
      { label: 'Internal', value: 'Yes' },
      { label: 'Attachable', value: 'No' },
      { label: 'RepoTags', value: 'a:1, b:2' },
    ]);
  });

  it('returns nothing for a record that is not a record', () => {
    expect(inspectEntries(null)).toEqual([]);
    expect(inspectEntries('sha256:abc')).toEqual([]);
    expect(inspectEntries([1, 2])).toEqual([]);
  });
});
