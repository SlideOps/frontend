import { Text } from '@slideops/design-system';
import { BookOpen, FileText, Mark } from '@slideops/icons';
import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Glow, Grain, Reveal } from '../motion';
import gettingStarted from '../docs/getting-started.md?raw';
import serversAndProjects from '../docs/servers-and-projects.md?raw';
import howAnOperationWorks from '../docs/how-an-operation-works.md?raw';

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
];

/**
 * The docs section, brought onto the warm-light paper world so the how-it-works
 * reading is calm and legible whichever app theme is set. A little ambient warmth
 * and the tactile grain carry the inspiration still behind it, the fox mark
 * anchors the intro, and the list and the article reveal on scroll. The markdown
 * is still rendered by react-markdown and all three starter docs are unchanged.
 */
export function Docs() {
  const [activeSlug, setActiveSlug] = useState(docs[0]!.slug);
  const active = docs.find((doc) => doc.slug === activeSlug) ?? docs[0]!;

  return (
    <section id="docs" className="so-paper-world relative isolate overflow-hidden">
      {/* Warm embers and the paper grain behind the docs, all decorative. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <Glow color="ember" size="34rem" x="90%" y="-6%" />
        <Glow color="rose" size="26rem" x="2%" y="104%" />
        <Grain style={{ position: 'absolute' }} />
      </div>

      <div className="mx-auto max-w-6xl px-6 py-20 md:py-24">
        <Reveal className="max-w-2xl">
          <span className="inline-flex items-center gap-2">
            <Mark size={26} />
            <Text variant="caption" tone="accent">
              Docs
            </Text>
          </span>
          <Text as="h2" variant="h1" className="mt-3">
            Secure your servers, then run Projects on them
          </Text>
          <Text variant="body" tone="secondary" className="mt-5">
            Plain-language guides to how SlideOps works: connect and secure a server, then create
            Projects, install only what each one needs, and deploy. The product teaches as you go, and
            these cover the shape of it before you start.
          </Text>
        </Reveal>

        <Reveal
          delay={0.1}
          className="mt-10 grid gap-6 lg:grid-cols-[16rem_1fr]"
        >
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
                    selected
                      ? 'border-accent bg-subtle'
                      : 'border-border bg-surface hover:bg-subtle'
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
        </Reveal>
      </div>
    </section>
  );
}
