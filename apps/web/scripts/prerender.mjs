#!/usr/bin/env node
/*
 * Turn the built single page app into a site a crawler can read.
 *
 * Runs after `vite build` and `vite build --ssr src/entry-prerender.tsx`. For
 * every public page in src/seo/head.ts it renders the page's real HTML and
 * writes it with that page's own head (title, description, canonical, Open
 * Graph, structured data) to its own file:
 *
 *   /                          dist/index.html
 *   /pricing                   dist/pricing.html
 *   /docs/start/quick-start    dist/docs/start/quick-start.html
 *
 * It also writes the app shell the signed-in routes are served (noindex), a
 * real 404 page, robots.txt, sitemap.xml, llms.txt, llms-full.txt, and
 * seo-manifest.json (a fingerprint of each page's content, which
 * scripts/indexnow.mjs uses to tell search engines only about pages that
 * changed).
 *
 * The build fails rather than shipping a page with no title, a duplicate title,
 * a missing description, no h1 or two, or a public route that rendered the not
 * found page. Those are the mistakes that quietly cost a listing.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(webRoot, 'dist');
const ssrDist = path.join(webRoot, 'dist-ssr');
const ROOT_ELEMENT = '<div id="root"></div>';
const NOT_FOUND_TEXT = 'There is no page at this address';
const DOCS_NOT_FOUND_TEXT = 'That page has moved';

function fail(message) {
  console.error(`prerender: ${message}`);
  process.exit(1);
}

const entryFile = ['entry-prerender.js', 'entry-prerender.mjs']
  .map((name) => path.join(ssrDist, name))
  .find((file) => fs.existsSync(file));
if (!entryFile) {
  fail('the server build is missing; run `vite build --ssr src/entry-prerender.tsx --outDir dist-ssr` first');
}
const ssr = await import(pathToFileURL(entryFile).href);

const templatePath = path.join(dist, 'index.html');
if (!fs.existsSync(templatePath)) fail('dist/index.html is missing; run `vite build` first');
const template = fs.readFileSync(templatePath, 'utf8');
if (!template.includes(ROOT_ELEMENT)) {
  fail(`dist/index.html has no empty ${ROOT_ELEMENT}; was it prerendered already?`);
}

/** The template with the tags this step owns taken out, ready for a page's own. */
const bareTemplate = template
  .replace(/<title>[\s\S]*?<\/title>\s*/i, '')
  .replace(/<(meta|link)\b[^>]*\bdata-seo\b[^>]*>\s*/gi, '')
  .replace(/<script\b[^>]*\bdata-seo\b[^>]*>[\s\S]*?<\/script>\s*/gi, '');

function documentFor(headHtml, bodyHtml = '') {
  return bareTemplate
    .replace('</head>', `\n    ${headHtml}\n  </head>`)
    .replace(ROOT_ELEMENT, `<div id="root">${bodyHtml}</div>`);
}

function write(relative, content) {
  const file = path.join(dist, relative);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

/** Where a public path's HTML goes. Clean URLs serve /pricing from pricing.html. */
function fileFor(pagePath) {
  return pagePath === '/' ? 'index.html' : `${pagePath.slice(1)}.html`;
}

function fingerprint(...parts) {
  return crypto.createHash('sha256').update(parts.join('\n')).digest('hex').slice(0, 20);
}

const problems = [];
const seenTitles = new Map();
const manifest = {};

// The app shell comes from the untouched template, before index.html is replaced.
write('app-shell.html', documentFor(ssr.renderHeadHtml(ssr.appShellHead)));

for (const page of ssr.publicPages) {
  const body = ssr.render(page.path);
  const headHtml = ssr.renderHeadHtml(ssr.publicHead(page));
  const where = page.path;

  if (!page.title.trim()) problems.push(`${where}: empty title`);
  if (seenTitles.has(page.title)) {
    problems.push(`${where}: title "${page.title}" is also ${seenTitles.get(page.title)}'s`);
  }
  seenTitles.set(page.title, where);
  if (page.description.length < 50 || page.description.length > 200) {
    problems.push(`${where}: description is ${page.description.length} characters, want 50 to 200`);
  }
  const h1s = (body.match(/<h1[\s>]/g) ?? []).length;
  if (h1s !== 1) problems.push(`${where}: ${h1s} h1 elements, want exactly one`);
  if (body.includes(NOT_FOUND_TEXT) || body.includes(DOCS_NOT_FOUND_TEXT)) {
    problems.push(`${where}: rendered the not found page`);
  }

  write(fileFor(page.path), documentFor(headHtml, body));
  manifest[page.path] = fingerprint(headHtml, body);
}

const notFoundBody = ssr.render('/__slideops_no_such_page__');
if (!notFoundBody.includes(NOT_FOUND_TEXT)) problems.push('404.html: did not render the not found page');
write('404.html', documentFor(ssr.renderHeadHtml(ssr.notFoundHead), notFoundBody));

write('robots.txt', ssr.robotsTxt());
write('sitemap.xml', ssr.sitemapXml());
write('llms.txt', ssr.llmsTxt());
write('llms-full.txt', ssr.llmsFullTxt());
write(
  'seo-manifest.json',
  `${JSON.stringify({ site: ssr.SITE_URL, pages: manifest }, null, 2)}\n`,
);

fs.rmSync(ssrDist, { recursive: true, force: true });

if (problems.length > 0) {
  for (const problem of problems) console.error(`prerender: ${problem}`);
  fail(`${problems.length} problem(s); nothing about this build is ready to publish`);
}
console.log(
  `prerender: ${ssr.publicPages.length} public pages, 404.html, app-shell.html, robots.txt, sitemap.xml, llms.txt, llms-full.txt`,
);
