/*
 * The documentation manifest: the single source of truth for what the docs
 * contain and in what order.
 *
 * Navigation, previous and next, search and routing all read this module and
 * nothing else. Titles live here rather than being parsed out of the markdown
 * so the shell keeps working while a page's prose is still being written, and
 * so reordering the docs is one edit in one file.
 */

/** The identifier of a documentation section, used as the first route segment. */
export type DocsSectionId =
  | 'start'
  | 'build'
  | 'infrastructure'
  | 'connect'
  | 'observe'
  | 'configure'
  | 'automate'
  | 'account'
  | 'reference';

/** One documentation page. */
export interface DocsPageEntry {
  /** The section this page belongs to. */
  readonly section: DocsSectionId;
  /** The page's own route segment, unique within its section. */
  readonly slug: string;
  /** What the page is called, everywhere it is named. */
  readonly title: string;
  /** One line saying what the page answers. */
  readonly summary: string;
  /** The page's route, derived from its section and slug. */
  readonly path: string;
  /** Where the page's markdown lives, relative to the docs content root. */
  readonly contentKey: string;
}

/** A group of pages presented together in the navigation. */
export interface DocsSection {
  readonly id: DocsSectionId;
  readonly title: string;
  readonly pages: readonly DocsPageEntry[];
}

/** The route the documentation lives at. */
export const DOCS_ROOT_PATH = '/docs';

interface SectionSource {
  readonly id: DocsSectionId;
  readonly title: string;
  readonly pages: readonly {
    readonly slug: string;
    readonly title: string;
    readonly summary: string;
  }[];
}

/*
 * Declared as a flat list because the order of this list is the order of the
 * docs: the navigation, the landing page and the previous and next links all
 * walk it, so there is no second place where order could disagree.
 */
const sources: readonly SectionSource[] = [
  {
    id: 'start',
    title: 'Start here',
    pages: [
      {
        slug: 'what-slideops-is',
        title: 'What SlideOps is',
        summary: 'The problem it solves, and what it deliberately is not.',
      },
      {
        slug: 'core-concepts',
        title: 'Core concepts',
        summary: 'Workspace, Project, Server, Service, Capability, Operation.',
      },
      {
        slug: 'quick-start',
        title: 'Quick start',
        summary: 'From a fresh account to a secured server and a running Service.',
      },
      {
        slug: 'how-an-operation-works',
        title: 'How an Operation works',
        summary: 'The lifecycle every Operation follows, step by step.',
      },
    ],
  },
  {
    id: 'build',
    title: 'Build',
    pages: [
      {
        slug: 'projects',
        title: 'Projects',
        summary: 'One stack, the servers it runs on, and the Services inside it.',
      },
      {
        slug: 'services',
        title: 'Services',
        summary: 'A deployed workload, its status, and what you can do with it.',
      },
      {
        slug: 'deploying',
        title: 'Deploying',
        summary: 'Where a workload comes from and how it runs on the machine.',
      },
      {
        slug: 'environment-and-secrets',
        title: 'Environment and secrets',
        summary: 'Configuration values, sealed secrets, and when they take effect.',
      },
      {
        slug: 'redeploying-and-rollback',
        title: 'Redeploying and rollback',
        summary: 'Shipping a new commit, and getting the last one back.',
      },
    ],
  },
  {
    id: 'infrastructure',
    title: 'Infrastructure',
    pages: [
      {
        slug: 'servers',
        title: 'Servers',
        summary: 'Connecting a machine, checking it, and securing it.',
      },
      {
        slug: 'server-users',
        title: 'Server users',
        summary: 'The accounts on a machine and what each one may do.',
      },
      {
        slug: 'capabilities',
        title: 'Capabilities',
        summary: 'Installing something, and managing it afterwards.',
      },
      {
        slug: 'private-network',
        title: 'Private network',
        summary: 'Letting your servers reach each other without the public internet.',
      },
      {
        slug: 'terminal',
        title: 'Terminal',
        summary: 'A real shell on a server or inside a Service.',
      },
    ],
  },
  {
    id: 'connect',
    title: 'Connect',
    pages: [
      {
        slug: 'domains-and-dns',
        title: 'Domains and DNS',
        summary: 'The address a Service answers on, and the records behind it.',
      },
      {
        slug: 'certificates',
        title: 'Certificates',
        summary: 'HTTPS, issuance, and renewal you do not have to remember.',
      },
      {
        slug: 'routing',
        title: 'Routing',
        summary: 'How a request reaches the right Service on the right port.',
      },
      {
        slug: 'firewall-and-database-access',
        title: 'Firewall and database access',
        summary: 'What is open, to whom, and how to reach a database safely.',
      },
    ],
  },
  {
    id: 'observe',
    title: 'Observe',
    pages: [
      {
        slug: 'activity',
        title: 'Activity',
        summary: 'What happened, to what, and in what order.',
      },
      {
        slug: 'logs',
        title: 'Logs',
        summary: 'Reading what a Service printed, live and after the fact.',
      },
      {
        slug: 'reports',
        title: 'Reports',
        summary: 'Verification evidence, posture, inventory and health, gathered.',
      },
    ],
  },
  {
    id: 'configure',
    title: 'Configure',
    pages: [
      {
        slug: 'credentials',
        title: 'Credentials',
        summary: 'Registry logins, repository access, and where they are kept.',
      },
      {
        slug: 'ssh-keys',
        title: 'SSH keys',
        summary: 'Adding a key, rotating one, and what it unlocks.',
      },
      {
        slug: 'snippets',
        title: 'Snippets',
        summary: 'Saved commands you run again without retyping them.',
      },
    ],
  },
  {
    id: 'automate',
    title: 'Automate',
    pages: [
      {
        slug: 'automations',
        title: 'Automations',
        summary: 'A Capability on a schedule, approved once and still verified.',
      },
    ],
  },
  {
    id: 'account',
    title: 'Account and teams',
    pages: [
      {
        slug: 'workspaces-and-teams',
        title: 'Workspaces and teams',
        summary: 'Working alone, and working with other people.',
      },
      {
        slug: 'roles-and-permissions',
        title: 'Roles and permissions',
        summary: 'Who may approve, who may only watch.',
      },
      {
        slug: 'billing',
        title: 'Billing',
        summary: 'Tiers, what each one bounds, and how payment works.',
      },
      {
        slug: 'security',
        title: 'Security',
        summary: 'Passwords, two step verification, and your sessions.',
      },
    ],
  },
  {
    id: 'reference',
    title: 'Reference',
    pages: [
      {
        slug: 'glossary',
        title: 'Glossary',
        summary: 'Every term SlideOps uses, defined once.',
      },
      {
        slug: 'troubleshooting',
        title: 'Troubleshooting',
        summary: 'What went wrong, why, and what to try next.',
      },
      {
        slug: 'api',
        title: 'API',
        summary: 'Talking to SlideOps from your own tools.',
      },
    ],
  },
];

/** Every section, in reading order, each holding its pages in reading order. */
export const docsSections: readonly DocsSection[] = sources.map((section) => ({
  id: section.id,
  title: section.title,
  pages: section.pages.map((page) => ({
    section: section.id,
    slug: page.slug,
    title: page.title,
    summary: page.summary,
    path: `${DOCS_ROOT_PATH}/${section.id}/${page.slug}`,
    contentKey: `${section.id}/${page.slug}`,
  })),
}));

/** Every page, flattened into the one order the docs are meant to be read in. */
export const docsPages: readonly DocsPageEntry[] = docsSections.flatMap((section) => section.pages);

const pagesByKey = new Map(docsPages.map((page) => [page.contentKey, page]));

/** The page at a section and slug, or undefined when there is no such page. */
export function findDocsPage(
  section: string | undefined,
  slug: string | undefined,
): DocsPageEntry | undefined {
  if (!section || !slug) return undefined;
  return pagesByKey.get(`${section}/${slug}`);
}

/** The section with this id, or undefined. */
export function findDocsSection(id: string | undefined): DocsSection | undefined {
  return docsSections.find((section) => section.id === id);
}

/** The page before and after this one in manifest order; undefined at the ends. */
export function docsNeighbours(page: DocsPageEntry): {
  previous: DocsPageEntry | undefined;
  next: DocsPageEntry | undefined;
} {
  const index = docsPages.findIndex((entry) => entry.contentKey === page.contentKey);
  return {
    previous: index > 0 ? docsPages[index - 1] : undefined,
    next: index >= 0 && index < docsPages.length - 1 ? docsPages[index + 1] : undefined,
  };
}

/** The first page of the docs, where the landing page sends a reader who wants to begin. */
export const docsFirstPage: DocsPageEntry = docsPages[0]!;
