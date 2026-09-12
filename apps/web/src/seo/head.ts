import { docsContent } from '../marketing/docs-site/content';
import {
  DOCS_ROOT_PATH,
  docsPages,
  findDocsSection,
  type DocsPageEntry,
} from '../marketing/docs-site/manifest';
import {
  capabilityCategoryCount,
  capabilityCount,
  marketplaceCapabilityCount,
} from '../marketing/content/capabilities';
import { faqItems } from '../marketing/sections/Faq';
import {
  absoluteUrl,
  DEFAULT_DESCRIPTION,
  OG_IMAGE_ALT,
  OG_IMAGE_HEIGHT,
  OG_IMAGE_PATH,
  OG_IMAGE_WIDTH,
  SITE_NAME,
  SITE_URL,
} from './site';

/*
 * What every address on the site tells search engines about itself.
 *
 * One registry of public pages, and one function from a path to its head. The
 * prerender step writes that head into each page's HTML, the client keeps it in
 * step as a visitor moves around, and the sitemap and llms.txt list the same
 * registry. A page is public because it is in this list and for no other
 * reason, so nothing private can drift into the sitemap by accident.
 */

/** Marks the head tags this module owns, so they can be replaced wholesale. */
export const HEAD_ATTRIBUTE = 'data-seo';

/** One tag in the document head. */
export interface HeadTag {
  readonly tag: 'meta' | 'link' | 'script';
  readonly attrs: Readonly<Record<string, string>>;
  readonly text?: string;
}

/** The title and managed tags for one address. */
export interface Head {
  readonly title: string;
  readonly tags: readonly HeadTag[];
}

/** A page that belongs in search results. */
export interface PublicPage {
  /** The canonical path: no trailing slash, except the home page's "/". */
  readonly path: string;
  /** The full document title. */
  readonly title: string;
  /** The search result summary. */
  readonly description: string;
  readonly kind: 'website' | 'article';
  /** Schema.org nodes describing the page, published as one JSON-LD graph. */
  readonly graph: readonly Record<string, unknown>[];
}

const ORGANIZATION_ID = `${SITE_URL}/#organization`;
const WEBSITE_ID = `${SITE_URL}/#website`;
const SOFTWARE_ID = `${SITE_URL}/#software`;

const organization = {
  '@type': 'Organization',
  '@id': ORGANIZATION_ID,
  name: SITE_NAME,
  url: absoluteUrl('/'),
  logo: {
    '@type': 'ImageObject',
    url: absoluteUrl('/icon-512.png'),
    width: 512,
    height: 512,
  },
};

const website = {
  '@type': 'WebSite',
  '@id': WEBSITE_ID,
  name: SITE_NAME,
  url: absoluteUrl('/'),
  description: DEFAULT_DESCRIPTION,
  inLanguage: 'en',
  publisher: { '@id': ORGANIZATION_ID },
};

const software = {
  '@type': 'SoftwareApplication',
  '@id': SOFTWARE_ID,
  name: SITE_NAME,
  url: absoluteUrl('/'),
  applicationCategory: 'DeveloperApplication',
  operatingSystem: 'Web browser; manages Linux servers over SSH',
  description: DEFAULT_DESCRIPTION,
  publisher: { '@id': ORGANIZATION_ID },
};

function webPage(path: string, title: string, description: string, type = 'WebPage') {
  return {
    '@type': type,
    '@id': `${absoluteUrl(path)}#webpage`,
    url: absoluteUrl(path),
    name: title,
    description,
    inLanguage: 'en',
    isPartOf: { '@id': WEBSITE_ID },
    about: { '@id': SOFTWARE_ID },
  };
}

function breadcrumbs(trail: readonly { name: string; path: string }[]) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((step, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: step.name,
      item: absoluteUrl(step.path),
    })),
  };
}

/** A marketing page: the site-wide entities, then the page itself. */
function marketingPage(
  path: string,
  title: string,
  description: string,
  extra: readonly Record<string, unknown>[] = [],
): PublicPage {
  return {
    path,
    title,
    description,
    kind: 'website',
    graph: [organization, website, software, webPage(path, title, description), ...extra],
  };
}

/*
 * The descriptions below restate what each page itself says. A summary that
 * promised more than the page delivers would earn the click and lose the
 * reader, and search engines rewrite snippets that do not match the page.
 */
const marketingPages: readonly PublicPage[] = [
  marketingPage(
    '/',
    'SlideOps: Operate your own servers with confidence',
    'One control plane for the servers you own: SSH, Docker, systemd, databases and security. Every meaningful change is planned, approved, verified and recorded.',
    [
      {
        '@type': 'FAQPage',
        '@id': `${absoluteUrl('/')}#faq`,
        mainEntity: faqItems.map((item) => ({
          '@type': 'Question',
          name: item.question,
          acceptedAnswer: { '@type': 'Answer', text: item.answer },
        })),
      },
    ],
  ),
  marketingPage(
    '/story',
    'Why SlideOps: one clear path from intent to a verified outcome',
    'Secure your servers first, then run Projects on them. Nothing runs until you approve a plan, and a change that fails its checks is rolled back automatically.',
  ),
  marketingPage(
    '/capabilities',
    'Capabilities: Core server security and a marketplace · SlideOps',
    `${capabilityCount} Capabilities across ${capabilityCategoryCount} categories. Seven Core Capabilities secure every server you connect; the other ${marketplaceCapabilityCount} are Plugins you install per Project.`,
  ),
  marketingPage(
    '/audience',
    'Who SlideOps is for: anyone who runs their own Linux',
    'Developers, platform engineers, self hosters, home labs, startups and teams. SlideOps meets you where you are and keeps you in control of your own servers.',
  ),
  marketingPage(
    '/pricing',
    'Pricing: the command center, not your hardware · SlideOps',
    'Plans meter only what SlideOps provides: the servers you connect, the Projects you run, team seats and support. Never the CPU, memory or disk of your own servers.',
  ),
];

const DOCS_TITLE = 'SlideOps Documentation';
const DOCS_DESCRIPTION =
  'How SlideOps works, in plain language: connect and secure a server, create Projects, install only what each one needs, and deploy.';

const docsHome: PublicPage = {
  path: DOCS_ROOT_PATH,
  title: DOCS_TITLE,
  description: DOCS_DESCRIPTION,
  kind: 'website',
  graph: [
    organization,
    website,
    webPage(DOCS_ROOT_PATH, DOCS_TITLE, DOCS_DESCRIPTION, 'CollectionPage'),
    breadcrumbs([
      { name: SITE_NAME, path: '/' },
      { name: 'Documentation', path: DOCS_ROOT_PATH },
    ]),
  ],
};

/**
 * The first paragraph of a page's prose, as plain text.
 *
 * Skips the title, headings, lists, tables, quotes and code, so what comes
 * back is the sentence the page opens its argument with.
 */
export function firstParagraph(markdown: string): string {
  const collected: string[] = [];
  let inFence = false;
  for (const raw of markdown.split('\n')) {
    const line = raw.trim();
    if (line.startsWith('```')) {
      inFence = !inFence;
      if (collected.length > 0) break;
      continue;
    }
    if (inFence) continue;
    if (line === '') {
      if (collected.length > 0) break;
      continue;
    }
    if (/^(#|\||>|[-*+] |\d+\. |<)/.test(line)) {
      if (collected.length > 0) break;
      continue;
    }
    collected.push(line);
  }
  return collected
    .join(' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/(\*\*|__)(.+?)\1/g, '$2')
    .replace(/(\*|_)(.+?)\1/g, '$2')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Text cut to fit a search result: at a sentence end if one fits, else a word. */
export function summarize(text: string, max = 160): string {
  if (text.length <= max) return text;
  const window = text.slice(0, max);
  const sentenceEnd = Math.max(window.lastIndexOf('. '), window.lastIndexOf('? '));
  if (sentenceEnd >= max * 0.5) return window.slice(0, sentenceEnd + 1);
  const wordEnd = window.lastIndexOf(' ');
  return `${window.slice(0, wordEnd > 0 ? wordEnd : max - 1).replace(/[,;:]$/, '')}…`;
}

function docsPageMeta(page: DocsPageEntry): PublicPage {
  const section = findDocsSection(page.section);
  const opening = firstParagraph(docsContent(page));
  const description = summarize(opening || `${page.title}: ${page.summary}`);
  const title = `${page.title} · SlideOps Docs`;
  return {
    path: page.path,
    title,
    description,
    kind: 'article',
    graph: [
      organization,
      website,
      {
        ...webPage(page.path, title, description, 'TechArticle'),
        headline: page.title,
        articleSection: section?.title ?? page.section,
        publisher: { '@id': ORGANIZATION_ID },
        mainEntityOfPage: absoluteUrl(page.path),
      },
      breadcrumbs([
        { name: SITE_NAME, path: '/' },
        { name: 'Documentation', path: DOCS_ROOT_PATH },
        { name: page.title, path: page.path },
      ]),
    ],
  };
}

/** Every page that belongs in search results, in the order the sitemap lists them. */
export const publicPages: readonly PublicPage[] = [
  ...marketingPages,
  docsHome,
  ...docsPages.map(docsPageMeta),
];

const pagesByPath = new Map(publicPages.map((page) => [page.path, page]));

/*
 * Addresses that exist but are nobody's search result: the signed-in areas and
 * the one-time links an email carries. They are served, so the app works when
 * someone opens one, and they say noindex, so a leaked link never becomes a
 * listing.
 */
const privateAreas: readonly { prefix: string; exact?: boolean; title: string }[] = [
  { prefix: '/login', exact: true, title: 'Sign in · SlideOps' },
  { prefix: '/register', exact: true, title: 'Create your account · SlideOps' },
  { prefix: '/mfa', exact: true, title: 'Two step verification · SlideOps' },
  { prefix: '/invitations/', title: 'Accept an invitation · SlideOps' },
  { prefix: '/node-transfers/', title: 'Accept a server transfer · SlideOps' },
  { prefix: '/admin', title: 'SlideOps Admin' },
  { prefix: '/app', title: 'SlideOps' },
];

const noindex: HeadTag = {
  tag: 'meta',
  attrs: { name: 'robots', content: 'noindex, nofollow' },
};

/** A path as the registry keys it: no query, no hash, no trailing slash. */
export function normalizePath(pathname: string): string {
  const bare = pathname.split(/[?#]/)[0] || '/';
  return bare.length > 1 ? bare.replace(/\/+$/, '') || '/' : bare;
}

/** The public page at this path, if there is one. */
export function findPublicPage(pathname: string): PublicPage | undefined {
  return pagesByPath.get(normalizePath(pathname));
}

/** The head of a page that belongs in search results. */
export function publicHead(page: PublicPage): Head {
  const url = absoluteUrl(page.path);
  const image = absoluteUrl(OG_IMAGE_PATH);
  const meta = (attrs: Record<string, string>): HeadTag => ({ tag: 'meta', attrs });
  return {
    title: page.title,
    tags: [
      meta({ name: 'description', content: page.description }),
      { tag: 'link', attrs: { rel: 'canonical', href: url } },
      meta({ name: 'robots', content: 'index, follow, max-image-preview:large' }),
      meta({ property: 'og:type', content: page.kind }),
      meta({ property: 'og:site_name', content: SITE_NAME }),
      meta({ property: 'og:locale', content: 'en_US' }),
      meta({ property: 'og:title', content: page.title }),
      meta({ property: 'og:description', content: page.description }),
      meta({ property: 'og:url', content: url }),
      meta({ property: 'og:image', content: image }),
      meta({ property: 'og:image:width', content: String(OG_IMAGE_WIDTH) }),
      meta({ property: 'og:image:height', content: String(OG_IMAGE_HEIGHT) }),
      meta({ property: 'og:image:alt', content: OG_IMAGE_ALT }),
      meta({ name: 'twitter:card', content: 'summary_large_image' }),
      meta({ name: 'twitter:title', content: page.title }),
      meta({ name: 'twitter:description', content: page.description }),
      meta({ name: 'twitter:image', content: image }),
      meta({ name: 'twitter:image:alt', content: OG_IMAGE_ALT }),
      {
        tag: 'script',
        attrs: { type: 'application/ld+json' },
        text: JSON.stringify({ '@context': 'https://schema.org', '@graph': page.graph }),
      },
    ],
  };
}

/** The head of an address with no page: a real 404, never a listing. */
export const notFoundHead: Head = {
  title: 'Page not found · SlideOps',
  tags: [noindex],
};

/** The head the app shell carries before the router has said where it is. */
export const appShellHead: Head = {
  title: SITE_NAME,
  tags: [noindex],
};

/** The head for any path the site serves or might be asked for. */
export function headFor(pathname: string): Head {
  const path = normalizePath(pathname);
  const page = pagesByPath.get(path);
  if (page) return publicHead(page);
  for (const area of privateAreas) {
    const matches = area.exact
      ? path === area.prefix
      : path === area.prefix.replace(/\/$/, '') || path.startsWith(area.prefix.endsWith('/') ? area.prefix : `${area.prefix}/`);
    if (matches) return { title: area.title, tags: [noindex] };
  }
  return notFoundHead;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** The head as HTML, for writing into a prerendered page. */
export function renderHeadHtml(head: Head): string {
  const lines = [`<title>${escapeHtml(head.title)}</title>`];
  for (const tag of head.tags) {
    const attrs = Object.entries(tag.attrs)
      .map(([name, value]) => `${name}="${escapeHtml(value)}"`)
      .join(' ');
    if (tag.tag === 'script') {
      // "<" inside JSON would let a string close the script element early.
      const body = (tag.text ?? '').replace(/</g, '\\u003c');
      lines.push(`<script ${attrs} ${HEAD_ATTRIBUTE}>${body}</script>`);
    } else {
      lines.push(`<${tag.tag} ${attrs} ${HEAD_ATTRIBUTE} />`);
    }
  }
  return lines.join('\n    ');
}
