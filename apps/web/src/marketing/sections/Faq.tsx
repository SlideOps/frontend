import { Text } from '@slideops/design-system';
import { Minus, Plus } from '@slideops/icons';
import { useState } from 'react';

interface Item {
  question: string;
  answer: string;
}

const items: Item[] = [
  {
    question: 'Does SlideOps take control of my servers?',
    answer:
      'No. You always own the infrastructure. SlideOps connects over SSH to orchestrate and explain the tools you already run, and it operates with least privilege as a non-root account. It never owns your servers, you do.',
  },
  {
    question: 'Will hardening SSH ever lock me out?',
    answer:
      'No. When SlideOps drops root and switches to a non-root administrator, it proves the new access works with a fresh connection before it commits the change. A change that would cut off your access is caught and rolled back automatically.',
  },
  {
    question: 'What is Core versus the marketplace?',
    answer:
      'Only security is Core, pre-installed on every server: Secure SSH, the host Firewall, Create Application User, and Manage Packages and updates. Everything else, from containers and reverse proxies to databases and runtimes, is a marketplace Plugin you install per Project.',
  },
  {
    question: 'How does deploying from GitHub work?',
    answer:
      'You connect your own GitHub OAuth app once. A Service with a repository source clones on its first deploy, then pulls the branch you name on every redeploy, so there is no need to re-clone.',
  },
  {
    question: 'Which Linux distributions are supported?',
    answer:
      'The major families: Ubuntu, Debian, Fedora, Arch, Alpine, and openSUSE, across apt, dnf, pacman, apk, and zypper, with systemd and OpenRC. A Capability names the outcome you want, and the right Provider carries it out on your platform.',
  },
  {
    question: 'How are my credentials handled?',
    answer:
      'Connection secrets are sealed: encrypted at rest and decrypted only at connection time. They are never shown, logged, or returned. Host keys are trusted on first use and pinned after.',
  },
  {
    question: 'Can several Projects share one server?',
    answer:
      'Yes, that is the point of the two-level model. Every Service runs under a fixed CPU, memory, and disk ceiling set by your tier, so many Projects can share one large server without fighting for resources.',
  },
];

/** An accessible FAQ, built as real disclosures with keyboard and ARIA support. */
export function Faq() {
  const [open, setOpen] = useState<Record<number, boolean>>({ 0: true });

  return (
    <section id="faq" className="mx-auto max-w-3xl px-6 py-20 md:py-24">
      <div className="so-rise text-center">
        <Text variant="caption" tone="accent">
          Questions
        </Text>
        <Text as="h2" variant="h1" className="mt-3">
          Answers before you connect a thing
        </Text>
      </div>

      <div className="so-rise-2 mt-10 flex flex-col gap-3">
        {items.map((item, index) => {
          const isOpen = open[index] ?? false;
          const panelId = `faq-panel-${index}`;
          const buttonId = `faq-button-${index}`;
          return (
            <div
              key={item.question}
              className="rounded-lg border border-border bg-surface transition-colors duration-fast ease-standard"
            >
              <h3>
                <button
                  type="button"
                  id={buttonId}
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  onClick={() => setOpen((prev) => ({ ...prev, [index]: !isOpen }))}
                  className="flex w-full items-center justify-between gap-4 rounded-lg px-5 py-4 text-left transition-colors duration-fast ease-standard hover:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                >
                  <Text as="span" variant="body" className="font-semibold">
                    {item.question}
                  </Text>
                  <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-pill bg-subtle text-brand">
                    {isOpen ? (
                      <Minus width={15} height={15} aria-hidden />
                    ) : (
                      <Plus width={15} height={15} aria-hidden />
                    )}
                  </span>
                </button>
              </h3>
              <div
                id={panelId}
                role="region"
                aria-labelledby={buttonId}
                hidden={!isOpen}
                className="px-5 pb-5"
              >
                <Text variant="body-sm" tone="secondary">
                  {item.answer}
                </Text>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
