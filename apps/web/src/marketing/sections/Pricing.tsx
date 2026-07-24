import { Button } from '@slideops/design-system';
import {
  ArrowRight,
  Boxes,
  Cpu,
  FolderKanban,
  HardDrive,
  MemoryStick,
  Server,
  Sparkles,
  type LucideIcon,
} from '@slideops/icons';
import { Link } from 'react-router-dom';
import { signUpUrl } from '../content/site';
import { countLabel, formatMemory, formatVcpu, tiers, type Tier } from '../content/pricing';
import { Glow, Grain, Reveal } from '../motion';

/** Seconds each successive card waits before it reveals, so the row arrives in a wave. */
const CARD_STAGGER = 0.08;

/** A single quota line inside a card: an icon, what it counts, and the number. */
interface QuotaRow {
  icon: LucideIcon;
  label: string;
  value: string;
}

/** The account-level allowances of a tier: how much you may run in total. */
function accountQuotas(tier: Tier): QuotaRow[] {
  return [
    { icon: Server, label: 'Servers', value: countLabel(tier.servers, 'server') },
    { icon: FolderKanban, label: 'Projects', value: countLabel(tier.projects, 'Project') },
    { icon: Boxes, label: 'Services', value: countLabel(tier.services, 'Service') },
  ];
}

/** The hard limit every Service is held to, so Projects never fight for a server. */
function perServiceQuotas(tier: Tier): QuotaRow[] {
  return [
    { icon: Cpu, label: 'vCPU', value: `${formatVcpu(tier.vcpu)} vCPU` },
    { icon: MemoryStick, label: 'Memory', value: formatMemory(tier.memoryMb) },
    { icon: HardDrive, label: 'Disk', value: `${tier.diskGb} GB` },
  ];
}

/** One quota row, rendered the same in either group. */
function QuotaLine({ row, highlighted }: { row: QuotaRow; highlighted: boolean }) {
  const { icon: Icon, label, value } = row;
  return (
    <li className="flex items-center gap-3">
      <Icon
        width={16}
        height={16}
        className={highlighted ? 'text-[color:var(--so-peach)]' : 'text-[color:var(--so-hero-ink-faint)]'}
        aria-hidden
      />
      <span className="text-sm text-[color:var(--so-hero-ink-soft)]">{label}</span>
      <span className="ml-auto text-sm font-medium text-[color:var(--so-hero-ink)]">{value}</span>
    </li>
  );
}

/**
 * One tier card. The recommended tier lifts a little and warms: a cognac border,
 * a soft ember glow behind it, and a solid primary call, so the eye lands on it
 * without hiding the others. The lift is a static transform, not motion, so it is
 * identical under reduced motion; the reveal wave is the only animation.
 */
function TierCard({ tier, index }: { tier: Tier; index: number }) {
  const highlighted = tier.highlighted ?? false;
  return (
    <Reveal delay={index * CARD_STAGGER} className="h-full">
      <article
        className={[
          'relative flex h-full flex-col rounded-2xl border p-6',
          highlighted
            ? 'border-[color:var(--so-cognac)] bg-[var(--so-hero-panel)] shadow-lg lg:-translate-y-3'
            : 'border-[color:var(--so-hero-hairline)] bg-[var(--so-hero-panel)]',
        ].join(' ')}
      >
        {highlighted ? (
          <>
            {/* The warm ember accent behind the recommended tier, decorative. */}
            <Glow
              color="ember"
              size="22rem"
              x="50%"
              y="8%"
              pulse
              className="-z-10"
            />
            <span className="absolute -top-3 left-6 inline-flex items-center gap-1.5 rounded-pill bg-[color:var(--so-cognac)] px-3 py-1 text-xs font-semibold text-[color:var(--so-neutral-50)]">
              <Sparkles width={12} height={12} aria-hidden />
              Recommended
            </span>
          </>
        ) : null}

        <h3 className="font-display text-2xl font-semibold text-[color:var(--so-hero-ink)]">
          {tier.name}
        </h3>
        <p className="mt-2 min-h-[2.75rem] text-sm leading-relaxed text-[color:var(--so-hero-ink-soft)]">
          {tier.summary}
        </p>

        <ul className="mt-6 flex flex-col gap-3 border-t border-[color:var(--so-hero-hairline)] pt-6">
          {accountQuotas(tier).map((row) => (
            <QuotaLine key={row.label} row={row} highlighted={highlighted} />
          ))}
        </ul>

        <p className="mt-6 text-xs font-medium uppercase tracking-wide text-[color:var(--so-hero-ink-faint)]">
          Hard limit per Service
        </p>
        <ul className="mt-3 flex flex-col gap-3">
          {perServiceQuotas(tier).map((row) => (
            <QuotaLine key={row.label} row={row} highlighted={highlighted} />
          ))}
        </ul>

        <div className="mt-8 pt-2">
          {highlighted ? (
            <Link to={signUpUrl} className="block">
              <Button size="lg" className="w-full">
                Get started
                <ArrowRight width={18} height={18} aria-hidden />
              </Button>
            </Link>
          ) : (
            <Link
              to={signUpUrl}
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-md border border-[color:var(--so-hero-hairline)] bg-[color:var(--so-marketing-ink)] px-6 text-base font-medium text-[color:var(--so-hero-ink)] transition-colors duration-fast ease-standard hover:border-[color:var(--so-hero-ink-faint)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--so-marketing-ink)]"
            >
              Get started
              <ArrowRight width={18} height={18} aria-hidden />
            </Link>
          )}
        </div>
      </article>
    </Reveal>
  );
}

/**
 * The tiers-and-resource-hosting beat, on the warm-dark hero-world so the card
 * grid reads as the video's pricing beat in our palette. SlideOps meters what you
 * run, not what it costs, so each tier is a set of quotas: how many servers,
 * Projects, and Services you may run, and the hard limit every Service is held to.
 * The recommended tier (Pro) lifts with a warm ember accent from the palette. The
 * cards reveal in a gentle wave, and every call signs up through the shared route.
 */
export function Pricing() {
  return (
    <section id="pricing" className="so-hero-world relative isolate overflow-hidden">
      {/* Ambient warmth behind the whole beat, all decorative. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <Glow color="ember" size="46rem" x="50%" y="-6%" pulse />
        <Glow color="warm" size="40rem" x="8%" y="90%" />
        <Grain style={{ position: 'absolute' }} />
      </div>

      <div className="mx-auto max-w-6xl px-6 py-20 md:py-28">
        <div className="max-w-2xl">
          <Reveal kind="fade">
            <span className="inline-flex items-center gap-2 rounded-pill border border-[color:var(--so-hero-hairline)] bg-[var(--so-hero-panel)] px-3 py-1 text-xs font-medium uppercase tracking-wide text-[color:var(--so-hero-ink-faint)]">
              Tiers and resource hosting
            </span>
          </Reveal>
          <Reveal kind="slide" direction="up" delay={0.05}>
            <h2 className="mt-6 font-display text-4xl font-semibold tracking-tight text-[color:var(--so-hero-ink)] md:text-5xl">
              Run many Projects on one server, under hard limits
            </h2>
          </Reveal>
          <Reveal kind="fade" delay={0.15}>
            <p className="mt-6 text-lg leading-relaxed text-[color:var(--so-hero-ink-soft)]">
              SlideOps meters what you run, not what it costs. Each tier sets how many servers,
              Projects, and Services you may run, and the hard CPU, memory, and disk limit every
              Service is held to. Because every Service is capped, several Projects can share one
              large server without ever fighting for its resources.
            </p>
          </Reveal>
        </div>

        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {tiers.map((tier, index) => (
            <TierCard key={tier.name} tier={tier} index={index} />
          ))}
        </div>

        <Reveal kind="fade" delay={0.1}>
          <p className="mt-10 text-sm text-[color:var(--so-hero-ink-faint)]">
            Every tier runs the same lifecycle on your own servers: plan, approve, execute, verify,
            and roll back, with live output, monitoring, and History throughout.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
