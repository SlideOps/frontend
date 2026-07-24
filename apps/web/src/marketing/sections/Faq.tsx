import { Text } from '@slideops/design-system';
import { ChevronRight } from '@slideops/icons';
import { AnimatePresence, motion } from 'framer-motion';
import { useId, useState } from 'react';
import { entranceEase, Glow, Grain, Reveal, useReducedMotion } from '../motion';

/** One question an Operator would really ask, with a truthful answer. */
interface Question {
  question: string;
  answer: string;
}

const questions: Question[] = [
  {
    question: 'Does SlideOps run my servers for me, or own my infrastructure?',
    answer:
      'No. You own your servers, and they stay yours. SlideOps connects over SSH to orchestrate and explain the tools you already run, like Docker, systemd, apt, NGINX, and Git. It never owns the infrastructure and never becomes a place your servers live.',
  },
  {
    question: 'Does SlideOps ever operate as root?',
    answer:
      'No. When you connect a server it creates a non-root administrator and turns off root sign-in over SSH, then operates only as that account from then on. It never holds root and never asks you to leave root open.',
  },
  {
    question: 'What does it change without asking?',
    answer:
      'Nothing. Every change is planned first and shown to you, runs only after you approve it, and is verified afterward. If a check does not pass, or a change would cut you off from the server, it is rolled back before it counts.',
  },
  {
    question: 'What does it work on?',
    answer:
      'Any Linux server you can reach over SSH, across the major distributions. A Capability describes the outcome you want, and a Provider carries it out in the way the Linux family your server runs expects, so the same intent works on different systems.',
  },
  {
    question: 'How does GitHub work?',
    answer:
      'You connect your own GitHub OAuth app, so the connection is yours. Services then pull the branch you name and deploy from your repository under the Project that owns them. Your code and your credentials stay yours.',
  },
  {
    question: 'What do the tiers limit?',
    answer:
      'How many servers, Projects, and Services you may run, and the hard CPU, memory, and disk each Service may use. Because every Service is capped, several Projects can share one server without ever fighting for its resources.',
  },
];

/**
 * One accessible disclosure row. The question is a real button that toggles the
 * answer: it carries aria-expanded and aria-controls, so keyboard and assistive
 * technology read the open state correctly, and Enter or Space toggle it because
 * it is a native button. The answer panel is a labelled region referenced by the
 * button. The chevron rotates and the panel eases open with a height transition;
 * under reduced motion the chevron and panel snap with no animation and the
 * answer simply appears.
 */
function FaqItem({ item, index }: { item: Question; index: number }) {
  const [open, setOpen] = useState(false);
  const reduced = useReducedMotion();
  const base = useId();
  const buttonId = `${base}-button`;
  const panelId = `${base}-panel`;

  return (
    <Reveal delay={index * 0.05}>
      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        <h3 className="m-0">
          <button
            id={buttonId}
            type="button"
            aria-expanded={open}
            aria-controls={panelId}
            onClick={() => setOpen((value) => !value)}
            className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors duration-fast ease-standard hover:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          >
            <Text as="span" variant="body" className="font-medium">
              {item.question}
            </Text>
            <ChevronRight
              width={18}
              height={18}
              aria-hidden
              className="shrink-0 text-accent transition-transform duration-base ease-standard"
              style={{ transform: open ? 'rotate(90deg)' : 'rotate(0deg)' }}
            />
          </button>
        </h3>
        <div id={panelId} role="region" aria-labelledby={buttonId}>
          {reduced ? (
            open ? (
              <p className="px-5 pb-5 text-[color:var(--color-text-secondary)]">{item.answer}</p>
            ) : null
          ) : (
            <AnimatePresence initial={false}>
              {open ? (
                <motion.div
                  key="content"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.32, ease: entranceEase }}
                  style={{ overflow: 'hidden', willChange: 'height, opacity' }}
                >
                  <p className="px-5 pb-5 text-[color:var(--color-text-secondary)]">
                    {item.answer}
                  </p>
                </motion.div>
              ) : null}
            </AnimatePresence>
          )}
        </div>
      </div>
    </Reveal>
  );
}

/**
 * The FAQ beat, on the warm-light paper-world. An accessible accordion answering
 * the real questions an Operator would ask, with answers true to what SlideOps
 * does: it orchestrates the tools you already run and never owns your
 * infrastructure, it never operates as root, it changes nothing without a planned
 * and verified approval, it works on any Linux server reached over SSH, GitHub
 * runs through your own OAuth app, and the tiers meter what you run. Each row is a
 * real disclosure, and the whole section reveals on scroll and is complete and
 * still under reduced motion.
 */
export function Faq() {
  return (
    <section id="faq" className="so-paper-world relative isolate overflow-hidden">
      {/* A little ambient warmth and the tactile grain, decorative and behind copy. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <Glow color="ember" size="32rem" x="8%" y="2%" />
        <Glow color="rose" size="30rem" x="96%" y="94%" />
        <Grain style={{ position: 'absolute' }} />
      </div>

      <div className="mx-auto max-w-3xl px-6 py-20 md:py-24">
        <Reveal className="max-w-2xl">
          <Text variant="caption" tone="accent">
            FAQ
          </Text>
          <Text as="h2" variant="h1" className="mt-3">
            The questions Operators ask first
          </Text>
          <Text variant="body" tone="secondary" className="mt-5">
            Straight answers about what SlideOps does, what it never does, and where you stay in
            control.
          </Text>
        </Reveal>

        <div className="mt-10 flex flex-col gap-3">
          {questions.map((item, index) => (
            <FaqItem key={item.question} item={item} index={index} />
          ))}
        </div>
      </div>
    </section>
  );
}
