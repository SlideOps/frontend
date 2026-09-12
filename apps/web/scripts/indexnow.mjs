#!/usr/bin/env node
/*
 * Tell IndexNow (Bing, Yandex, Seznam, Naver and the other participating
 * engines) which public pages were added, changed or removed.
 *
 * Each deploy publishes /seo-manifest.json, a fingerprint of every public
 * page's content (scripts/prerender.mjs). This compares the live manifest with
 * the one from the last notification and submits only the difference, because
 * resubmitting pages that did not change is exactly what IndexNow asks sites not
 * to do.
 *
 *   node scripts/indexnow.mjs --previous .indexnow/last.json --save .indexnow/last.json
 *   node scripts/indexnow.mjs --all            every public page (a first launch)
 *   node scripts/indexnow.mjs --dry-run ...    print what would be sent
 *
 * Run it after a production deploy has finished, never before: a crawler that
 * answers the ping straight away should find the new page, not the old one.
 * .github/workflows/indexnow.yml does this on every successful production
 * deployment. The key is public by design and lives at /<key>.txt on the site.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE = (process.env.SEO_SITE_URL || 'https://www.useslideops.com').replace(/\/$/, '');
const ENDPOINT = 'https://api.indexnow.org/indexnow';
const BATCH = 10000;

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const option = (name) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};

function fail(message) {
  console.error(`indexnow: ${message}`);
  process.exit(1);
}

const publicDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
const keyFile = fs.readdirSync(publicDir).find((name) => /^[a-f0-9]{32}\.txt$/.test(name));
if (!keyFile) fail(`no IndexNow key file (32 hex characters, .txt) in ${publicDir}`);
const key = keyFile.replace(/\.txt$/, '');

async function liveManifest() {
  const response = await fetch(`${SITE}/seo-manifest.json`, { headers: { 'cache-control': 'no-cache' } });
  if (!response.ok) fail(`${SITE}/seo-manifest.json answered ${response.status}; is this build deployed?`);
  const manifest = await response.json();
  if (!manifest || typeof manifest.pages !== 'object') fail('the live seo-manifest.json has no pages');
  return manifest;
}

function readPrevious(file) {
  if (!file || !fs.existsSync(file)) return undefined;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return undefined;
  }
}

const url = (pagePath) => (pagePath === '/' ? `${SITE}/` : `${SITE}${pagePath}`);

const current = await liveManifest();
const previous = flag('--all') ? undefined : readPrevious(option('--previous'));

let changed;
if (!previous) {
  changed = Object.keys(current.pages);
  console.log(`indexnow: no earlier manifest, so all ${changed.length} public pages`);
} else {
  const before = previous.pages ?? {};
  const added = Object.keys(current.pages).filter((p) => !(p in before));
  const updated = Object.keys(current.pages).filter((p) => p in before && before[p] !== current.pages[p]);
  const removed = Object.keys(before).filter((p) => !(p in current.pages));
  changed = [...added, ...updated, ...removed];
  console.log(`indexnow: ${added.length} added, ${updated.length} changed, ${removed.length} removed`);
}

if (changed.length > 0) {
  const urlList = changed.map(url);
  if (flag('--dry-run')) {
    for (const entry of urlList) console.log(`  ${entry}`);
  } else {
    // The key file must answer on the host being notified, or the submission is refused.
    const keyCheck = await fetch(`${SITE}/${key}.txt`);
    if (!keyCheck.ok || (await keyCheck.text()).trim() !== key) {
      fail(`${SITE}/${key}.txt does not serve the key; deploy the key file first`);
    }
    for (let start = 0; start < urlList.length; start += BATCH) {
      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'content-type': 'application/json; charset=utf-8' },
        body: JSON.stringify({
          host: new URL(SITE).host,
          key,
          keyLocation: `${SITE}/${key}.txt`,
          urlList: urlList.slice(start, start + BATCH),
        }),
      });
      // 200 and 202 both mean accepted; anything else is worth failing the job over.
      if (response.status !== 200 && response.status !== 202) {
        fail(`IndexNow answered ${response.status}: ${await response.text()}`);
      }
    }
    console.log(`indexnow: submitted ${urlList.length} URL(s)`);
  }
}

const save = option('--save');
if (save && !flag('--dry-run')) {
  fs.mkdirSync(path.dirname(save), { recursive: true });
  fs.writeFileSync(save, `${JSON.stringify(current, null, 2)}\n`);
}
