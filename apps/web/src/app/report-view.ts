import type { Report, ReportSection } from '@slideops/api-client';

/*
 * Turning a report into something readable.
 *
 * The Reports screen rendered `report.sections`, and the API has never sent a
 * `sections` field. It sends `report.data`, a differently shaped payload per
 * report type. So every report fell through to "This report has no content to
 * show", on a backend that was returning twelve kilobytes of verification
 * evidence. The screen has never worked.
 *
 * This maps each real payload to the sections the renderer already understands,
 * rather than asking the backend to send presentation. Which report type it is
 * decides what is worth showing and in what order, because a verification report
 * and an inventory report have nothing in common except the word report: one is
 * evidence that something was proved, the other is a list of machines.
 *
 * It is pure, so the mapping can be tested against real captured payloads
 * without a browser or a server.
 */

/** A value that may be missing, rendered as something rather than "undefined". */
function text(value: unknown, fallback = 'Not recorded'): string {
  if (value === null || value === undefined || value === '') {
    return fallback;
  }
  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }
  return String(value);
}

/** A timestamp in the reader's own locale, or a dash when there is none. */
function when(value: unknown): string {
  if (typeof value !== 'string' || value === '') {
    return 'Not recorded';
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
}

/** Count words agreeing with their number, since "1 checks" reads as a bug. */
function plural(count: number, one: string, many = `${one}s`): string {
  return `${count} ${count === 1 ? one : many}`;
}

type Payload = Record<string, unknown>;

function asArray(value: unknown): Payload[] {
  return Array.isArray(value) ? (value as Payload[]) : [];
}

function asRecord(value: unknown): Payload {
  return value && typeof value === 'object' ? (value as Payload) : {};
}

/**
 * Verification: what was proved, and the evidence for it.
 *
 * The summary leads, because "22 of 22 passed" is the answer; the checks are the
 * evidence behind it and are what makes the report worth printing.
 */
function verificationSections(data: Payload): ReportSection[] {
  const summary = asRecord(data.summary);
  const results = asArray(data.results);
  const total = Number(summary.total ?? 0);
  const passed = Number(summary.passed ?? 0);
  const failed = Number(summary.failed ?? 0);

  const sections: ReportSection[] = [
    {
      title: 'Summary',
      summary:
        total === 0
          ? 'No Operations have been verified yet.'
          : failed === 0
            ? `Every one of ${plural(total, 'verification')} passed.`
            : `${failed} of ${plural(total, 'verification')} failed.`,
      rows: [
        { label: 'Verified', value: String(total) },
        { label: 'Passed', value: String(passed) },
        { label: 'Failed', value: String(failed) },
      ],
    },
  ];

  if (results.length > 0) {
    sections.push({
      title: 'Results',
      table: {
        headers: ['Capability', 'Outcome', 'Checks', 'Completed'],
        rows: results.map((result) => {
          const checks = asArray(result.checks);
          const failedChecks = checks.filter((check) => check.passed === false).length;
          return [
            text(result.capability_key),
            result.passed ? 'Passed' : 'Failed',
            failedChecks === 0
              ? `${plural(checks.length, 'check')} passed`
              : `${failedChecks} of ${plural(checks.length, 'check')} failed`,
            when(result.completed_at),
          ];
        }),
      },
    });

    // The individual checks are the evidence. A verification report that only
    // said "passed" would be an assertion, which is the thing it exists to
    // replace.
    for (const result of results.slice(0, 20)) {
      const checks = asArray(result.checks);
      if (checks.length === 0) {
        continue;
      }
      sections.push({
        title: `Evidence: ${text(result.capability_key)}`,
        summary: `${when(result.completed_at)} · ${result.passed ? 'passed' : 'failed'}`,
        items: checks.map(
          (check) =>
            `${check.passed ? 'Passed' : 'Failed'}: ${text(check.name)} (${text(check.detail, 'no detail')})`,
        ),
      });
    }
  }
  return sections;
}

/** Inventory: the machines, and what each one is. */
function inventorySections(data: Payload): ReportSection[] {
  const nodes = asArray(data.nodes);
  if (nodes.length === 0) {
    return [{ title: 'Nodes', summary: 'No servers are connected yet.' }];
  }
  return [
    {
      title: 'Nodes',
      summary: `${plural(nodes.length, 'server')} connected.`,
      table: {
        headers: ['Name', 'Address', 'Status', 'Operating system', 'Kernel'],
        rows: nodes.map((node) => [
          text(node.name),
          text(node.address),
          text(node.status),
          [text(node.os, ''), text(node.distro_version, '')].filter(Boolean).join(' ') || 'Unknown',
          text(node.kernel),
        ]),
      },
    },
  ];
}

/** Operations: what has been run, and how it went. */
function operationsSections(data: Payload): ReportSection[] {
  const total = Number(data.total ?? 0);
  const byStatus = asRecord(data.by_status);
  const byCapability = asRecord(data.by_capability);
  const recent = asArray(data.recent);

  const failed = Number(byStatus.failed ?? 0);
  const sections: ReportSection[] = [
    {
      title: 'Summary',
      summary:
        total === 0
          ? 'Nothing has been run yet.'
          : `${plural(total, 'Operation')}, ${failed === 0 ? 'none of which failed' : `${failed} of which failed`}.`,
      rows: Object.entries(byStatus).map(([status, count]) => ({
        label: status,
        value: String(count),
      })),
    },
  ];

  const capabilities = Object.entries(byCapability).sort((a, b) => Number(b[1]) - Number(a[1]));
  if (capabilities.length > 0) {
    sections.push({
      title: 'By Capability',
      summary: 'Most run first.',
      table: {
        headers: ['Capability', 'Times run'],
        rows: capabilities.map(([key, count]) => [key, String(count)]),
      },
    });
  }

  if (recent.length > 0) {
    sections.push({
      title: 'Recent',
      table: {
        headers: ['Capability', 'Status', 'Started', 'Finished'],
        rows: recent.map((operation) => [
          text(operation.capability_key),
          text(operation.status),
          when(operation.created_at),
          when(operation.completed_at),
        ]),
      },
    });
  }
  return sections;
}

/** Security: the posture of each server, in the terms that decide it. */
function securitySections(data: Payload): ReportSection[] {
  const nodes = asArray(data.nodes);
  if (nodes.length === 0) {
    return [{ title: 'Posture', summary: 'No servers are connected yet.' }];
  }

  const sections: ReportSection[] = [
    {
      title: 'Posture',
      summary: `${plural(nodes.length, 'server')}.`,
      table: {
        headers: ['Server', 'Root login', 'Password auth', 'Firewall', 'Last read'],
        rows: nodes.map((node) => {
          const ssh = asRecord(node.ssh);
          const firewall = asRecord(node.firewall);
          return [
            text(node.name),
            text(ssh.permit_root_login),
            // Said as the safe answer rather than the raw value, because "false"
            // is not obviously the good outcome at a glance.
            ssh.password_authentication === false ? 'Refused' : 'Allowed',
            firewall.active ? `Active${firewall.backend ? ` (${firewall.backend})` : ''}` : 'None',
            node.has_discovery ? when(node.discovered_at) : 'Never read',
          ];
        }),
      },
    },
  ];

  // A server nothing has read cannot be reported on, and saying so is better
  // than a row of blanks that reads as a clean bill of health.
  const unread = nodes.filter((node) => !node.has_discovery);
  if (unread.length > 0) {
    sections.push({
      title: 'Not yet read',
      summary:
        'Run Discovery on these before relying on this report. Nothing has been observed about them.',
      items: unread.map((node) => text(node.name)),
    });
  }
  return sections;
}

/** Health: how one server is doing right now. */
function healthSections(data: Payload): ReportSection[] {
  const metrics = asRecord(data.metrics);
  const current = asRecord(metrics.current);
  const history = asArray(metrics.history);

  const sections: ReportSection[] = [
    {
      title: text(data.node_name, 'This server'),
      summary: 'The most recent reading.',
      rows: [
        { label: 'Load average', value: text(current.load_average) },
        { label: 'Memory used', value: `${text(current.memory_used_percent, '0')}%` },
        { label: 'Disk used', value: `${text(current.disk_used_percent, '0')}%` },
        { label: 'Running services', value: text(current.running_services) },
        { label: 'Uptime', value: uptime(current.uptime_seconds) },
        { label: 'Taken', value: when(current.at) },
      ],
    },
  ];

  if (history.length > 0) {
    sections.push({
      title: 'Recent readings',
      summary: `${plural(history.length, 'reading')}, newest first.`,
      table: {
        headers: ['When', 'Load', 'Memory %', 'Disk %', 'Services'],
        rows: history
          .slice(-20)
          .reverse()
          .map((reading) => [
            when(reading.at),
            text(reading.load_average),
            text(reading.memory_used_percent),
            text(reading.disk_used_percent),
            text(reading.running_services),
          ]),
      },
    });
  }
  return sections;
}

/** Seconds as something a person reads, rather than a large number. */
function uptime(seconds: unknown): string {
  const total = Number(seconds);
  if (!Number.isFinite(total) || total <= 0) {
    return 'Not recorded';
  }
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  if (days > 0) {
    return `${plural(days, 'day')}, ${plural(hours, 'hour')}`;
  }
  const minutes = Math.floor((total % 3600) / 60);
  return hours > 0
    ? `${plural(hours, 'hour')}, ${plural(minutes, 'minute')}`
    : plural(minutes, 'minute');
}

/** What each report is called, in the Operator's terms rather than its key. */
const titles: Record<string, string> = {
  verification: 'Verification report',
  inventory: 'Inventory report',
  operations: 'Operations report',
  security: 'Security posture report',
  health: 'Health report',
};

/**
 * Read a report into sections the renderer can show.
 *
 * A backend that starts sending `sections` itself is honoured as is, so this
 * never fights a future API; it only fills the gap where the payload is typed
 * data and the screen needs something to render.
 */
export function reportSections(report: Report): ReportSection[] {
  if (report.sections && report.sections.length > 0) {
    return report.sections;
  }
  const data = asRecord((report as Payload).data);
  switch (report.type) {
    case 'verification':
      return verificationSections(data);
    case 'inventory':
      return inventorySections(data);
    case 'operations':
      return operationsSections(data);
    case 'security':
      return securitySections(data);
    case 'health':
      return healthSections(data);
    default:
      return [];
  }
}

/** The report's title, preferring one the backend supplied. */
export function reportTitle(report: Report): string {
  return report.title ?? titles[String(report.type)] ?? `${report.type} report`;
}
