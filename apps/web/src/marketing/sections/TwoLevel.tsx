import { Text } from '@slideops/design-system';
import {
  Boxes,
  Check,
  FolderKanban,
  GitBranch,
  KeyRound,
  Search,
  Server,
  ShieldCheck,
  Users,
} from '@slideops/icons';
import { useReveal } from '../useReveal';

const serverSteps = [
  { icon: Server, label: 'Connect over SSH', note: 'Host key trusted on first use.' },
  { icon: Search, label: 'Run the quick check', note: 'Read-only Discovery and Assessment.' },
  {
    icon: ShieldCheck,
    label: 'Secure with No Root',
    note: 'Non-root sudo, root sign-in disabled.',
  },
];

const projectStack = [
  { name: 'Containers', origin: 'Plugin' },
  { name: 'Reverse proxy', origin: 'Plugin' },
  { name: 'HTTPS', origin: 'Plugin' },
  { name: 'PostgreSQL', origin: 'Plugin' },
];

/** The two-level model: secure servers once, then run resource-limited Projects on them. */
export function TwoLevel() {
  const { ref, shown } = useReveal<HTMLDivElement>();
  return (
    <section id="model" className="mx-auto max-w-6xl px-6 py-20 md:py-24">
      <div className="so-rise max-w-2xl">
        <Text variant="caption" tone="accent">
          The model
        </Text>
        <Text as="h2" variant="h1" className="mt-3">
          Secure your servers, then run Projects on them
        </Text>
        <Text variant="body" tone="secondary" className="mt-5">
          The two-level model is the spine of the product. You secure a server once, then let many
          Projects share it under hard limits, each carrying only the stack it needs. Keeping the
          two apart is what lets one large server do the work of a fleet.
        </Text>
      </div>

      <div
        ref={ref}
        className={`mt-12 grid items-stretch gap-6 lg:grid-cols-2 so-reveal${shown ? ' so-reveal-in' : ''}`}
      >
        {/* Level one: Servers */}
        <article className="so-stagger flex flex-col rounded-xl border border-border bg-surface p-6 md:p-8">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-pill bg-brand text-sm font-semibold text-brand-fg">
              1
            </span>
            <Text variant="h3">Servers</Text>
            <span className="ml-auto inline-flex items-center gap-1.5 rounded-pill border border-border bg-app px-2.5 py-1 text-xs font-medium text-ink-muted">
              <Server width={13} height={13} aria-hidden />
              Over SSH
            </span>
          </div>
          <Text variant="body-sm" tone="secondary" className="mt-3">
            Connect a Linux machine over SSH, run a read-only quick check, and secure it so SlideOps
            never operates as root.
          </Text>

          <ol className="mt-6 flex flex-col gap-3">
            {serverSteps.map(({ icon: Icon, label, note }) => (
              <li
                key={label}
                className="flex items-start gap-3 rounded-lg border border-border bg-app p-4"
              >
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-subtle text-brand">
                  <Icon width={18} height={18} aria-hidden />
                </span>
                <div className="min-w-0">
                  <Text as="span" variant="body-sm" className="block font-medium">
                    {label}
                  </Text>
                  <Text as="span" variant="body-sm" tone="secondary">
                    {note}
                  </Text>
                </div>
              </li>
            ))}
          </ol>

          <div className="mt-6 rounded-lg border border-border bg-raised p-4">
            <div className="flex items-center gap-2">
              <KeyRound width={15} height={15} className="text-brand" aria-hidden />
              <Text as="span" variant="caption" tone="secondary">
                No Root, verified before the switch
              </Text>
            </div>
            <Text variant="body-sm" tone="secondary" className="mt-2">
              SlideOps creates a non-root administrator with sudo, hardens SSH so root can no longer
              sign in, then switches its stored connection to that account. The new access is proven
              first, so you are never locked out.
            </Text>
            <div className="mt-3 flex flex-wrap gap-2">
              <PostureChip icon={Users} label="Non-root sudo" />
              <PostureChip icon={ShieldCheck} label="Root disabled" />
              <PostureChip icon={KeyRound} label="Credential rotated" />
            </div>
          </div>
        </article>

        {/* Level two: Projects */}
        <article className="so-stagger flex flex-col rounded-xl border border-border bg-surface p-6 md:p-8">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-pill bg-brand text-sm font-semibold text-brand-fg">
              2
            </span>
            <Text variant="h3">Projects</Text>
            <span className="ml-auto inline-flex items-center gap-1.5 rounded-pill border border-border bg-app px-2.5 py-1 text-xs font-medium text-ink-muted">
              <Boxes width={13} height={13} aria-hidden />
              On one server
            </span>
          </div>
          <Text variant="body-sm" tone="secondary" className="mt-3">
            Create a Project, assign one or more secured servers, install only the Plugins it needs,
            connect GitHub, and deploy resource-limited Services.
          </Text>

          {/* One server carrying several Projects under limits */}
          <div className="mt-6 rounded-lg border border-border bg-app p-4">
            <div className="flex items-center gap-2">
              <Server width={15} height={15} className="text-accent" aria-hidden />
              <Text as="span" variant="caption" tone="secondary">
                One secured server, many Projects, hard limits
              </Text>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <ProjectCard name="storefront" cpu="2.0 vCPU" mem="4 GB" fill="w-3/4" />
              <ProjectCard name="analytics" cpu="1.0 vCPU" mem="2 GB" fill="w-1/2" />
            </div>
            <Text variant="body-sm" tone="secondary" className="mt-3">
              Every Service runs under a fixed CPU, memory, and disk ceiling, so Projects share a
              server without fighting for resources.
            </Text>
          </div>

          <div className="mt-6 rounded-lg border border-border bg-raised p-4">
            <div className="flex items-center gap-2">
              <FolderKanban width={15} height={15} className="text-brand" aria-hidden />
              <Text as="span" variant="caption" tone="secondary">
                Install only this Project's stack
              </Text>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {projectStack.map((item) => (
                <span
                  key={item.name}
                  className="inline-flex items-center gap-1.5 rounded-pill border border-border bg-app px-2.5 py-1 text-xs font-medium text-ink-muted"
                >
                  <Check width={12} height={12} className="text-success" aria-hidden />
                  {item.name}
                </span>
              ))}
              <span className="inline-flex items-center gap-1.5 rounded-pill border border-border bg-app px-2.5 py-1 text-xs font-medium text-ink-muted">
                <GitBranch width={12} height={12} className="text-accent" aria-hidden />
                GitHub
              </span>
            </div>
          </div>
        </article>
      </div>
    </section>
  );
}

function PostureChip({ icon: Icon, label }: { icon: typeof KeyRound; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-pill bg-subtle px-2.5 py-1 text-xs font-medium text-brand">
      <Icon width={12} height={12} aria-hidden />
      {label}
    </span>
  );
}

function ProjectCard({
  name,
  cpu,
  mem,
  fill,
}: {
  name: string;
  cpu: string;
  mem: string;
  fill: string;
}) {
  return (
    <div className="rounded-md border border-border bg-surface p-3">
      <div className="flex items-center gap-2">
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-sm bg-subtle text-brand">
          <FolderKanban width={13} height={13} aria-hidden />
        </span>
        <Text as="span" variant="body-sm" className="font-medium">
          {name}
        </Text>
      </div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-pill bg-subtle">
        <div className={`h-full rounded-pill bg-brand ${fill}`} />
      </div>
      <Text as="span" variant="caption" tone="secondary" className="mt-2 block">
        {cpu} - {mem}
      </Text>
    </div>
  );
}
