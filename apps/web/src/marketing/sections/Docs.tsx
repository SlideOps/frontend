import { Text } from '@slideops/design-system';
import { BookOpen, FileText } from '@slideops/icons';
import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import gettingStarted from '../docs/getting-started.md?raw';
import serversAndProjects from '../docs/servers-and-projects.md?raw';
import howAnOperationWorks from '../docs/how-an-operation-works.md?raw';
import dayToDay from '../docs/day-to-day.md?raw';

interface Doc {
  slug: string;
  title: string;
  summary: string;
  content: string;
}

const docs: Doc[] = [
  {
    slug: 'getting-started',
    title: 'Getting started',
    summary: 'From a fresh account to a secured server and a running Service.',
    content: gettingStarted,
  },
  {
    slug: 'servers-and-projects',
    title: 'Servers and Projects',
    summary: 'The two levels, Core versus the marketplace, and tiers.',
    content: serversAndProjects,
  },
  {
    slug: 'how-an-operation-works',
    title: 'How an Operation works',
    summary: 'The lifecycle every Operation follows, step by step.',
    content: howAnOperationWorks,
  },
  {
    slug: 'day-to-day',
    title: 'Day to day',
    summary: 'Readiness, adoption, terminals, Automations, Reports, and your account.',
    content: dayToDay,
  },
];

/** The docs section: real starter docs rendered from local markdown. */
export function Docs() {
  const [activeSlug, setActiveSlug] = useState(docs[0]!.slug);
  const active = docs.find((doc) => doc.slug === activeSlug) ?? docs[0]!;

  return (
    <section id="docs" className="mx-auto max-w-6xl px-6 py-20 md:py-24">
      <div className="so-rise max-w-2xl">
        <Text variant="caption" tone="accent">
          Docs
        </Text>
        <Text as="h2" variant="h1" className="mt-3">
          Secure your servers, then run Projects on them
        </Text>
        <Text variant="body" tone="secondary" className="mt-5">
          Plain-language guides to how SlideOps works: connect and secure a server, then create
          Projects, install only what each one needs, and deploy. The product teaches as you go, and
          these cover the shape of it before you start.
        </Text>
      </div>

      <div className="so-rise-2 mt-10 grid gap-6 lg:grid-cols-[16rem_1fr]">
        <nav aria-label="Documents" className="flex flex-col gap-2">
          {docs.map((doc) => {
            const selected = doc.slug === active.slug;
            return (
              <button
                key={doc.slug}
                type="button"
                aria-current={selected ? 'true' : undefined}
                onClick={() => setActiveSlug(doc.slug)}
                className={`flex items-start gap-3 rounded-lg border p-4 text-left transition-colors duration-fast ease-standard focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus ${
                  selected ? 'border-border bg-subtle' : 'border-border bg-surface hover:bg-subtle'
                }`}
              >
                <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-app text-brand">
                  <FileText width={16} height={16} aria-hidden />
                </span>
                <span className="min-w-0">
                  <Text as="span" variant="body-sm" className="block font-medium">
                    {doc.title}
                  </Text>
                  <Text as="span" variant="body-sm" tone="secondary" className="mt-0.5 block">
                    {doc.summary}
                  </Text>
                </span>
              </button>
            );
          })}
          <a
            href="#top"
            className="mt-2 inline-flex items-center gap-2 px-4 text-sm font-medium text-accent transition-colors duration-fast ease-standard hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          >
            <BookOpen width={15} height={15} aria-hidden />
            More docs are on the way
          </a>
        </nav>

        <article className="rounded-lg border border-border bg-surface p-6 shadow-sm md:p-10">
          <div className="so-prose max-w-none">
            <ReactMarkdown>{active.content}</ReactMarkdown>
          </div>
        </article>
      </div>
    </section>
  );
}
