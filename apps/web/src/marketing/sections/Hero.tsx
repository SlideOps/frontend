import { Button, Text } from '@slideops/design-system';
import {
  Activity,
  ArrowRight,
  Check,
  Container,
  Database,
  GitBranch,
  Server,
  ShieldCheck,
  Terminal,
} from '@slideops/icons';
import { Link } from 'react-router-dom';
import { signUpUrl } from '../content/site';

const deploymentModes = [
  { icon: GitBranch, label: 'Repository', detail: 'Deploy from Git with a repeatable plan.' },
  { icon: Container, label: 'Container', detail: 'Adopt running Docker workloads with context.' },
  { icon: Database, label: 'Capability', detail: 'Install and manage databases as first-class services.' },
];

const assurances = ['Your servers stay yours', 'Approval before changes', 'Verified after execution'];

export function Hero() {
  return (
    <>
      <section id="top" className="relative overflow-hidden border-b border-border">
        <div className="pointer-events-none absolute inset-0 opacity-60 [background-image:linear-gradient(to_right,var(--color-border)_1px,transparent_1px),linear-gradient(to_bottom,var(--color-border)_1px,transparent_1px)] [background-size:56px_56px] [mask-image:linear-gradient(to_bottom,black,transparent_74%)]" />
        <div className="relative mx-auto max-w-6xl px-6 pb-16 pt-20 text-center md:pb-24 md:pt-28">
          <div className="so-rise mx-auto inline-flex items-center gap-2 rounded-pill border border-border bg-surface px-3 py-1.5 text-xs font-medium text-ink-muted shadow-sm">
            <ShieldCheck width={14} height={14} className="text-success" aria-hidden />
            Infrastructure operations, in plain language
          </div>
          <h1 className="so-rise-2 mx-auto mt-7 max-w-4xl text-balance font-display text-5xl font-semibold leading-[0.98] tracking-tight text-ink md:text-7xl">
            Operate your own infrastructure with confidence.
          </h1>
          <Text variant="body" tone="secondary" className="so-rise-3 mx-auto mt-6 max-w-2xl text-base md:text-lg">
            SlideOps turns SSH, Docker, systemd, databases, and security into one observable control plane. You stay in charge of the servers. Every meaningful change is planned, approved, verified, and recorded.
          </Text>
          <div className="so-rise-3 mt-8 flex flex-wrap justify-center gap-3">
            <Link to={signUpUrl}>
              <Button size="lg" className="group">
                Connect a server
                <ArrowRight width={17} height={17} className="transition-transform group-hover:translate-x-0.5" aria-hidden />
              </Button>
            </Link>
            <Link to="/docs"><Button size="lg" variant="secondary">Read the docs</Button></Link>
          </div>
          <ul className="so-rise-3 mx-auto mt-8 flex max-w-2xl flex-wrap justify-center gap-x-5 gap-y-2 text-xs text-ink-muted">
            {assurances.map((assurance) => (
              <li key={assurance} className="inline-flex items-center gap-1.5">
                <Check width={13} height={13} className="text-success" aria-hidden />
                {assurance}
              </li>
            ))}
          </ul>
          <ProductPreview />
        </div>
      </section>
      <section className="border-b border-border bg-subtle/40">
        <div className="mx-auto grid max-w-6xl gap-px px-6 py-12 md:grid-cols-3 md:py-16">
          {deploymentModes.map(({ icon: Icon, label, detail }) => (
            <div key={label} className="border-border px-4 py-4 md:border-l md:first:border-l-0 md:px-8">
              <Icon width={19} height={19} className="text-ink-muted" aria-hidden />
              <Text variant="h4" className="mt-4">{label}</Text>
              <Text variant="body-sm" tone="secondary" className="mt-1 max-w-xs">{detail}</Text>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

function ProductPreview() {
  return (
    <div className="so-rise relative mx-auto mt-16 max-w-5xl text-left md:mt-20">
      <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-lg">
        <div className="flex items-center justify-between border-b border-border px-4 py-3 text-xs text-ink-muted md:px-5">
          <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-success" /> edge-01</div>
          <span>Node overview</span>
          <span className="hidden md:inline">Updated just now</span>
        </div>
        <div className="grid md:grid-cols-[13rem_1fr]">
          <aside className="hidden border-r border-border p-3 md:block">
            <div className="mb-5 flex items-center gap-2 px-2 text-sm font-semibold"><Server width={15} height={15} aria-hidden /> SlideOps</div>
            {['Overview', 'Services', 'Capabilities', 'History', 'Settings'].map((item, index) => (
              <div key={item} className={`rounded-md px-2.5 py-2 text-xs ${index === 0 ? 'bg-subtle font-medium text-ink' : 'text-ink-muted'}`}>{item}</div>
            ))}
          </aside>
          <div className="min-w-0 p-5 md:p-8">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div><Text variant="caption" tone="secondary">Server</Text><Text variant="h2" className="mt-1">edge-01</Text><Text variant="body-sm" tone="secondary" className="mt-1">Ubuntu 24.04 · 4 vCPU · 8 GB</Text></div>
              <span className="inline-flex items-center gap-1.5 rounded-pill border border-border px-2.5 py-1 text-xs text-success"><span className="h-1.5 w-1.5 rounded-full bg-success" /> Ready</span>
            </div>
            <div className="mt-7 grid gap-3 sm:grid-cols-3">
              <Metric label="Services" value="06" detail="2 running now" />
              <Metric label="Posture" value="92%" detail="1 recommendation" />
              <Metric label="CPU usage" value="34%" detail="last 15 minutes" />
            </div>
            <div className="mt-6 border-y border-border">
              <div className="flex items-center justify-between border-b border-border py-3"><span className="flex items-center gap-2 text-sm font-medium"><Activity width={15} height={15} aria-hidden /> Recent activity</span><span className="text-xs text-ink-muted">View history</span></div>
              <ActivityRow icon={Terminal} title="Deploy API service" meta="Verified · 2 minutes ago" />
              <ActivityRow icon={ShieldCheck} title="SSH hardening" meta="Completed · today" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <div className="border border-border bg-app px-3 py-3"><Text variant="caption" tone="secondary">{label}</Text><Text variant="h3" className="mt-2 tabular-nums">{value}</Text><Text variant="caption" tone="secondary" className="mt-1">{detail}</Text></div>;
}

function ActivityRow({ icon: Icon, title, meta }: { icon: typeof Activity; title: string; meta: string }) {
  return <div className="flex items-center gap-3 border-b border-border py-3 last:border-b-0"><span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-subtle text-ink-muted"><Icon width={14} height={14} aria-hidden /></span><span className="min-w-0 flex-1"><Text variant="body-sm" className="font-medium">{title}</Text><Text variant="caption" tone="secondary" className="mt-0.5">{meta}</Text></span><Check width={15} height={15} className="text-success" aria-hidden /></div>;
}
