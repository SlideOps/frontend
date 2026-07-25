import type {
  Assessment,
  AssessmentFinding,
  DiscoveryResult,
  Facts,
} from '@slideops/api-client';
import { Text } from '@slideops/design-system';
import {
  AlertTriangle,
  CheckCircle2,
  Container,
  Cpu,
  Database,
  Globe,
  Info,
  KeyRound,
  Layers,
  ListChecks,
  Network,
  Package,
  Shield,
  ShieldCheck,
  Sparkles,
  Users,
} from '@slideops/icons';
import { Guidance } from '@slideops/tooltips';
import type { ReactNode } from 'react';
import { Collapsible, useCollapsibleGroup, type CollapsibleGroupItem } from './Collapsible';
import { FactValue, humanize } from './FactsView';
import { RevealValue } from './RevealValue';

/** The Facts keys rendered by a named section, so the catch-all can skip them. */
const CONSUMED_FACT_KEYS = new Set([
  'os',
  'kernel',
  'package_manager',
  'service_manager',
  'pending_updates',
  'ssh',
  'ssh_posture',
  'sshd_config',
  'firewall',
  'containers',
  'web_servers',
  'git',
  'databases',
  'tls',
  'human_accounts',
  'listening_ports',
  'packages',
  'services',
]);

function LabeledRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-1 py-2 sm:grid-cols-[11rem_1fr] sm:items-center sm:gap-4">
      <dt className="text-xs font-medium text-ink-muted">{label}</dt>
      <dd className="min-w-0 break-words text-sm text-ink">{children}</dd>
    </div>
  );
}

function StatePill({ on, onLabel, offLabel }: { on: boolean; onLabel: string; offLabel: string }) {
  return (
    <span className={on ? 'text-sm font-medium text-success' : 'text-sm text-ink-muted'}>
      {on ? onLabel : offLabel}
    </span>
  );
}

function Chips({ items }: { items: Array<string | number> }) {
  if (items.length === 0) {
    return (
      <Text variant="body-sm" tone="secondary">
        None
      </Text>
    );
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item, index) => (
        <span
          key={`${String(item)}-${index}`}
          className="inline-flex rounded-md bg-subtle px-2 py-0.5 font-mono text-xs text-ink-muted"
        >
          {String(item)}
        </span>
      ))}
    </div>
  );
}

/** Findings that read as a warning or a critical risk, versus everything already in order. */
function isRisky(finding: AssessmentFinding): boolean {
  const severity = String(finding.severity ?? '').toLowerCase();
  return severity === 'warn' || severity === 'warning' || severity === 'critical';
}

function FindingItem({ finding }: { finding: AssessmentFinding }) {
  const risky = isRisky(finding);
  const critical = String(finding.severity ?? '').toLowerCase() === 'critical';
  const tone = critical ? 'text-danger' : risky ? 'text-warning' : 'text-success';
  const Icon = risky ? AlertTriangle : CheckCircle2;
  return (
    <li className="flex items-start gap-3">
      <Icon width={18} height={18} className={`mt-0.5 shrink-0 ${tone}`} aria-hidden />
      <div className="min-w-0">
        <Text variant="body-sm" className="font-medium">
          {finding.title}
        </Text>
        <Text variant="body-sm" tone="secondary" className="mt-0.5">
          {finding.detail}
        </Text>
      </div>
    </li>
  );
}

function AssessmentFindings({ findings }: { findings: AssessmentFinding[] }) {
  const risky = findings.filter(isRisky);
  const settled = findings.filter((finding) => !isRisky(finding));
  return (
    <div className="flex flex-col gap-5">
      {risky.length > 0 ? (
        <div>
          <Text variant="caption" tone="secondary" className="flex items-center gap-2">
            <Shield width={13} height={13} aria-hidden />
            Worth your attention
          </Text>
          <ul className="mt-3 flex flex-col gap-3">
            {risky.map((finding, index) => (
              <FindingItem key={index} finding={finding} />
            ))}
          </ul>
        </div>
      ) : null}
      {settled.length > 0 ? (
        <div>
          <Text variant="caption" tone="secondary" className="flex items-center gap-2">
            <ShieldCheck width={13} height={13} aria-hidden />
            Already in order
          </Text>
          <ul className="mt-3 flex flex-col gap-3">
            {settled.map((finding, index) => (
              <FindingItem key={index} finding={finding} />
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function SshSection({ facts }: { facts: Facts }) {
  const ssh = facts.ssh;
  const posture = facts.ssh_posture;
  const effective = facts.ssh?.effective_config ?? facts.sshd_config;

  const permitRoot = ssh?.permit_root_login ?? posture?.permit_root_login;
  const passwordAuth =
    ssh?.password_authentication !== undefined
      ? ssh.password_authentication
        ? 'yes'
        : 'no'
      : posture?.password_authentication;

  const effectiveEntries = effective ? Object.entries(effective) : [];

  return (
    <dl className="flex flex-col divide-y divide-border">
      {ssh?.connected_auth_kind ? (
        <LabeledRow label="Signed in with">
          <span className="text-sm text-ink">{humanize(ssh.connected_auth_kind)}</span>
        </LabeledRow>
      ) : null}
      {permitRoot !== undefined ? (
        <LabeledRow label="Permit root login">
          <span className="font-mono text-sm text-ink">{permitRoot}</span>
        </LabeledRow>
      ) : null}
      {passwordAuth !== undefined ? (
        <LabeledRow label="Password sign in">
          <span className="font-mono text-sm text-ink">{passwordAuth}</span>
        </LabeledRow>
      ) : null}
      {ssh?.x11_forwarding !== undefined ? (
        <LabeledRow label="X11 forwarding">
          <StatePill on={ssh.x11_forwarding} onLabel="On" offLabel="Off" />
        </LabeledRow>
      ) : null}
      {ssh?.max_auth_tries !== undefined ? (
        <LabeledRow label="Max auth tries">
          <span className="font-mono text-sm text-ink">{ssh.max_auth_tries}</span>
        </LabeledRow>
      ) : null}
      {effectiveEntries.length > 0 ? (
        <div className="py-2">
          <Collapsible title="Effective SSH configuration" summary={`${effectiveEntries.length} directives`}>
            <Text variant="body-sm" tone="secondary" className="mb-3">
              The resolved sshd settings and key paths are hidden. Reveal a value to read it, or copy
              it without showing it.
            </Text>
            <dl className="flex flex-col divide-y divide-border">
              {effectiveEntries.map(([key, value]) => (
                <LabeledRow key={key} label={humanize(key)}>
                  <RevealValue value={String(value)} label={humanize(key)} sensitive />
                </LabeledRow>
              ))}
            </dl>
          </Collapsible>
        </div>
      ) : null}
    </dl>
  );
}

interface Section {
  id: string;
  title: string;
  icon: ReactNode;
  defaultOpen: boolean;
  summary?: ReactNode;
  content: ReactNode;
}

/**
 * The read-only scan, presented as calm, collapsible sections. The Assessment
 * leads, the technical Facts follow, and the noisy or sensitive parts (the full
 * SSH configuration, listening ports, package and service lists) start closed
 * and mask their values behind a reveal. Nothing here changes the Node.
 */
export function DiscoveryScan({ result }: { result: DiscoveryResult }) {
  const { assessment, facts } = result;
  const sections = buildSections(assessment, facts);

  const groupItems: CollapsibleGroupItem[] = sections.map((section) => ({
    id: section.id,
    defaultOpen: section.defaultOpen,
  }));
  const group = useCollapsibleGroup(groupItems);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Text variant="caption" tone="secondary">
            Scan
          </Text>
          <Guidance for="node.assessment" />
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={group.expandAll}
            disabled={group.allOpen}
            className="rounded-md px-2 py-1 text-xs font-medium text-ink-muted transition-colors duration-fast ease-standard hover:bg-subtle hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:opacity-50 disabled:pointer-events-none"
          >
            Expand all
          </button>
          <span aria-hidden className="text-ink-muted">
            ·
          </span>
          <button
            type="button"
            onClick={group.collapseAll}
            disabled={group.allClosed}
            className="rounded-md px-2 py-1 text-xs font-medium text-ink-muted transition-colors duration-fast ease-standard hover:bg-subtle hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:opacity-50 disabled:pointer-events-none"
          >
            Collapse all
          </button>
        </div>
      </div>

      {sections.map((section) => (
        <Collapsible
          key={section.id}
          title={section.title}
          summary={section.summary}
          icon={section.icon}
          open={group.isOpen(section.id)}
          onOpenChange={(open) => group.setOpen(section.id, open)}
        >
          {section.content}
        </Collapsible>
      ))}
    </div>
  );
}

function buildSections(assessment: Assessment, facts: Facts): Section[] {
  const sections: Section[] = [];

  if (assessment.summary) {
    sections.push({
      id: 'summary',
      title: 'Summary',
      icon: <Sparkles width={16} height={16} aria-hidden />,
      defaultOpen: true,
      content: (
        <Text variant="body" tone="secondary">
          {assessment.summary}
        </Text>
      ),
    });
  }

  if (assessment.findings.length > 0) {
    const risky = assessment.findings.filter(isRisky).length;
    sections.push({
      id: 'findings',
      title: 'Findings',
      icon: <ShieldCheck width={16} height={16} aria-hidden />,
      defaultOpen: true,
      summary: risky > 0 ? `${risky} to review` : 'All clear',
      content: <AssessmentFindings findings={assessment.findings} />,
    });
  }

  if (assessment.recommendations.length > 0) {
    sections.push({
      id: 'recommendations',
      title: 'Recommendations',
      icon: <ListChecks width={16} height={16} aria-hidden />,
      defaultOpen: true,
      summary: `${assessment.recommendations.length}`,
      content: (
        <ul className="flex flex-col gap-2">
          {assessment.recommendations.map((recommendation, index) => (
            <li key={index}>
              {recommendation.title ? (
                <Text variant="body-sm" className="font-medium">
                  {recommendation.title}
                </Text>
              ) : null}
              <Text variant="body-sm" tone="secondary">
                {recommendation.reason}
              </Text>
            </li>
          ))}
        </ul>
      ),
    });
  }

  if (assessment.inventory && assessment.inventory.length > 0) {
    sections.push({
      id: 'inventory',
      title: 'Inventory',
      icon: <Layers width={16} height={16} aria-hidden />,
      defaultOpen: false,
      summary: `${assessment.inventory.length}`,
      content: (
        <dl className="flex flex-col divide-y divide-border">
          {assessment.inventory.map((item, index) => (
            <LabeledRow key={index} label={item.category}>
              <span className="text-sm text-ink">{item.detail}</span>
            </LabeledRow>
          ))}
        </dl>
      ),
    });
  }

  const os = facts.os;
  if (os || facts.kernel || facts.package_manager || facts.service_manager) {
    sections.push({
      id: 'os',
      title: 'Operating system',
      icon: <Cpu width={16} height={16} aria-hidden />,
      defaultOpen: true,
      content: (
        <dl className="flex flex-col divide-y divide-border">
          {os?.pretty_name || os?.name ? (
            <LabeledRow label="Distribution">
              <RevealValue value={os.pretty_name ?? os.name ?? ''} label="distribution" sensitive={false} />
            </LabeledRow>
          ) : null}
          {facts.kernel ? (
            <LabeledRow label="Kernel">
              <RevealValue value={facts.kernel} label="kernel" sensitive={false} />
            </LabeledRow>
          ) : null}
          {facts.package_manager ? (
            <LabeledRow label="Package manager">
              <span className="font-mono text-sm text-ink">{facts.package_manager}</span>
            </LabeledRow>
          ) : null}
          {facts.service_manager ? (
            <LabeledRow label="Service manager">
              <span className="font-mono text-sm text-ink">{facts.service_manager}</span>
            </LabeledRow>
          ) : null}
          {typeof facts.pending_updates === 'number' ? (
            <LabeledRow label="Pending updates">
              <StatePill
                on={facts.pending_updates > 0}
                onLabel={`${facts.pending_updates} available`}
                offLabel="Up to date"
              />
            </LabeledRow>
          ) : null}
        </dl>
      ),
    });
  }

  if (facts.ssh || facts.ssh_posture || facts.sshd_config) {
    sections.push({
      id: 'ssh',
      title: 'Security posture (SSH)',
      icon: <KeyRound width={16} height={16} aria-hidden />,
      defaultOpen: false,
      content: <SshSection facts={facts} />,
    });
  }

  if (facts.firewall) {
    sections.push({
      id: 'firewall',
      title: 'Firewall',
      icon: <Shield width={16} height={16} aria-hidden />,
      defaultOpen: false,
      summary:
        facts.firewall.active === undefined ? undefined : facts.firewall.active ? 'Active' : 'Inactive',
      content: (
        <dl className="flex flex-col divide-y divide-border">
          {facts.firewall.backend ? (
            <LabeledRow label="Backend">
              <span className="font-mono text-sm text-ink">{facts.firewall.backend}</span>
            </LabeledRow>
          ) : null}
          {facts.firewall.active !== undefined ? (
            <LabeledRow label="State">
              <StatePill on={facts.firewall.active} onLabel="Active" offLabel="Inactive" />
            </LabeledRow>
          ) : null}
        </dl>
      ),
    });
  }

  if (facts.containers) {
    sections.push({
      id: 'containers',
      title: 'Containers',
      icon: <Container width={16} height={16} aria-hidden />,
      defaultOpen: false,
      content: (
        <dl className="flex flex-col divide-y divide-border">
          <LabeledRow label="Docker">
            <StatePill on={!!facts.containers.docker_present} onLabel="Present" offLabel="Not present" />
          </LabeledRow>
          {facts.containers.runtime ? (
            <LabeledRow label="Runtime">
              <span className="font-mono text-sm text-ink">{facts.containers.runtime}</span>
            </LabeledRow>
          ) : null}
        </dl>
      ),
    });
  }

  if (facts.web_servers) {
    sections.push({
      id: 'web_servers',
      title: 'Web servers',
      icon: <Globe width={16} height={16} aria-hidden />,
      defaultOpen: false,
      content: (
        <dl className="flex flex-col divide-y divide-border">
          <LabeledRow label="NGINX">
            <StatePill on={!!facts.web_servers.nginx_present} onLabel="Present" offLabel="Not present" />
          </LabeledRow>
          <LabeledRow label="Caddy">
            <StatePill on={!!facts.web_servers.caddy_present} onLabel="Present" offLabel="Not present" />
          </LabeledRow>
        </dl>
      ),
    });
  }

  if (facts.databases && facts.databases.length > 0) {
    sections.push({
      id: 'databases',
      title: 'Databases',
      icon: <Database width={16} height={16} aria-hidden />,
      defaultOpen: false,
      summary: `${facts.databases.length}`,
      content: (
        <dl className="flex flex-col divide-y divide-border">
          {facts.databases.map((database, index) => (
            <LabeledRow key={index} label={database.engine ? humanize(database.engine) : 'Engine'}>
              <span className="flex flex-wrap items-center gap-2">
                {database.version ? (
                  <RevealValue value={database.version} label="database version" sensitive={false} />
                ) : null}
                {database.running !== undefined ? (
                  <StatePill on={database.running} onLabel="Running" offLabel="Stopped" />
                ) : null}
              </span>
            </LabeledRow>
          ))}
        </dl>
      ),
    });
  }

  if (facts.git) {
    sections.push({
      id: 'git',
      title: 'Deploys (Git)',
      icon: <Package width={16} height={16} aria-hidden />,
      defaultOpen: false,
      content: (
        <dl className="flex flex-col divide-y divide-border">
          <LabeledRow label="Git">
            <StatePill on={!!facts.git.present} onLabel="Present" offLabel="Not present" />
          </LabeledRow>
          {facts.git.version ? (
            <LabeledRow label="Version">
              <RevealValue value={facts.git.version} label="git version" sensitive={false} />
            </LabeledRow>
          ) : null}
        </dl>
      ),
    });
  }

  if (facts.tls) {
    const names = facts.tls.certificate_names ?? [];
    sections.push({
      id: 'tls',
      title: 'TLS certificates',
      icon: <Shield width={16} height={16} aria-hidden />,
      defaultOpen: false,
      summary: names.length > 0 ? `${names.length}` : undefined,
      content: (
        <dl className="flex flex-col divide-y divide-border">
          <LabeledRow label="Let's Encrypt">
            <StatePill on={!!facts.tls.lets_encrypt_present} onLabel="Present" offLabel="Not present" />
          </LabeledRow>
          {names.length > 0 ? (
            <LabeledRow label="Certificate names">
              <div className="flex flex-wrap gap-1.5">
                {names.map((name, index) => (
                  <RevealValue key={`${name}-${index}`} value={name} label="certificate name" sensitive />
                ))}
              </div>
            </LabeledRow>
          ) : null}
        </dl>
      ),
    });
  }

  if (typeof facts.human_accounts === 'number') {
    sections.push({
      id: 'accounts',
      title: 'Accounts',
      icon: <Users width={16} height={16} aria-hidden />,
      defaultOpen: false,
      summary: `${facts.human_accounts}`,
      content: (
        <dl className="flex flex-col divide-y divide-border">
          <LabeledRow label="Human accounts">
            <span className="text-sm text-ink">{facts.human_accounts}</span>
          </LabeledRow>
        </dl>
      ),
    });
  }

  if (facts.listening_ports && facts.listening_ports.length > 0) {
    sections.push({
      id: 'listening_ports',
      title: 'Listening ports',
      icon: <Network width={16} height={16} aria-hidden />,
      defaultOpen: false,
      summary: `${facts.listening_ports.length}`,
      content: <Chips items={facts.listening_ports} />,
    });
  }

  const hasPackages = facts.packages && facts.packages.length > 0;
  const hasServices = facts.services && facts.services.length > 0;
  if (hasPackages || hasServices) {
    sections.push({
      id: 'packages_services',
      title: 'Packages and services',
      icon: <Package width={16} height={16} aria-hidden />,
      defaultOpen: false,
      summary: `${facts.packages?.length ?? 0} · ${facts.services?.length ?? 0}`,
      content: (
        <div className="flex flex-col gap-4">
          {hasPackages ? (
            <div>
              <Text variant="caption" tone="secondary">
                Packages
              </Text>
              <div className="mt-2">
                <Chips items={facts.packages ?? []} />
              </div>
            </div>
          ) : null}
          {hasServices ? (
            <div>
              <Text variant="caption" tone="secondary">
                Services
              </Text>
              <div className="mt-2">
                <Chips items={facts.services ?? []} />
              </div>
            </div>
          ) : null}
        </div>
      ),
    });
  }

  const extra = Object.entries(facts).filter(
    ([key, value]) => !CONSUMED_FACT_KEYS.has(key) && value !== undefined && value !== null,
  );
  if (extra.length > 0) {
    sections.push({
      id: 'more_facts',
      title: 'More facts',
      icon: <Info width={16} height={16} aria-hidden />,
      defaultOpen: false,
      summary: `${extra.length}`,
      content: (
        <dl className="flex flex-col divide-y divide-border">
          {extra.map(([key, value]) => (
            <div key={key} className="grid grid-cols-1 gap-1 py-2 sm:grid-cols-[11rem_1fr] sm:gap-4">
              <dt className="text-xs font-medium text-ink-muted">{humanize(key)}</dt>
              <dd className="min-w-0">
                <FactValue value={value} />
              </dd>
            </div>
          ))}
        </dl>
      ),
    });
  }

  return sections;
}
