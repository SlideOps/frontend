import type { Domain, DomainState } from '@slideops/api-client';

/*
 * Reading a domain honestly.
 *
 * Four separate things have to be true before a hostname serves an application:
 * DNS answers with the address SlideOps expects, a route exists on the server,
 * a certificate was issued, and the Service behind it is actually answering.
 * They fail independently and each has a different fix, so they are read
 * independently here and never collapsed into one word.
 *
 * Nothing in this file invents a state. Every reading is derived from fields the
 * API returned, and where a field has not been filled in yet the reading says so
 * rather than guessing. "Not checked" is a real answer; "healthy" when nobody has
 * looked is not.
 */

export type StatusTone = 'ok' | 'warn' | 'bad' | 'muted';

export interface StatusReading {
  label: string;
  tone: StatusTone;
  /** What the label is based on, so the Operator can see the evidence. */
  detail?: string;
}

/**
 * A certificate inside this window is close enough to expiry to be worth
 * pointing at before it lapses, while still leaving room to fix a renewal that
 * is not happening.
 */
export const CERTIFICATE_RENEWAL_WINDOW_DAYS = 14;

const DAY_MS = 24 * 60 * 60 * 1000;

/** How each state of a domain reads in the Operator's own terms. */
export const DOMAIN_STATE_LABELS: Record<DomainState, string> = {
  pending_dns: 'Waiting for DNS',
  dns_verifying: 'Checking DNS',
  dns_verified: 'DNS points here',
  routing_pending: 'Setting up routing',
  routing_active: 'Routed',
  tls_pending: 'Getting a certificate',
  active: 'Serving',
  degraded: 'Degraded',
  failed: 'Failed',
  detached: 'No longer served',
};

/** Every state, in the order a domain passes through them. */
export const DOMAIN_STATES: DomainState[] = [
  'pending_dns',
  'dns_verifying',
  'dns_verified',
  'routing_pending',
  'routing_active',
  'tls_pending',
  'active',
  'degraded',
  'failed',
  'detached',
];

export function stateLabel(state: DomainState): string {
  return DOMAIN_STATE_LABELS[state] ?? state;
}

/**
 * What DNS answered, against what the record was supposed to say.
 *
 * The two values are always shown together. A hostname that resolves to
 * something is not the same as a hostname that resolves to the right thing, and
 * an Operator who moved a Service between servers hits exactly that difference.
 */
export function dnsReading(domain: Domain): StatusReading {
  const expected = domain.record.value;
  const found = domain.dns_observed;

  if (!domain.dns_checked_at) {
    return {
      label: 'Not checked',
      tone: 'muted',
      detail: `Expected ${expected}. Nothing has looked this name up yet.`,
    };
  }
  if (!found) {
    return {
      label: 'No answer',
      tone: 'bad',
      detail: `Expected ${expected}, found no answer.`,
    };
  }
  if (found === expected) {
    return {
      label: 'Points here',
      tone: 'ok',
      detail: `Expected ${expected}, found ${found}.`,
    };
  }
  return {
    label: 'Points elsewhere',
    tone: 'bad',
    detail: `Expected ${expected}, found ${found}.`,
  };
}

/** Whether the certificate exists, and how long it has left. */
export function certificateReading(domain: Domain, now: Date = new Date()): StatusReading {
  if (domain.tls_state === 'not_applicable') {
    return { label: 'Not needed', tone: 'muted' };
  }
  if (domain.tls_state === 'failed') {
    return {
      label: 'Failed',
      tone: 'bad',
      detail: domain.last_error ?? 'No certificate was issued for this hostname.',
    };
  }
  if (domain.tls_state === 'pending') {
    return { label: 'Being issued', tone: 'warn' };
  }

  if (!domain.tls_expires_at) {
    // Issued, but the API did not say until when. Saying "valid" with no date
    // behind it would be asserting more than was returned.
    return { label: 'Issued', tone: 'ok', detail: 'No expiry date was returned.' };
  }
  const expires = new Date(domain.tls_expires_at);
  const daysLeft = Math.floor((expires.getTime() - now.getTime()) / DAY_MS);
  if (daysLeft < 0) {
    return {
      label: 'Expired',
      tone: 'bad',
      detail: `Expired on ${expires.toLocaleDateString()}.`,
    };
  }
  if (daysLeft <= CERTIFICATE_RENEWAL_WINDOW_DAYS) {
    return {
      label: `Expires in ${daysLeft} ${daysLeft === 1 ? 'day' : 'days'}`,
      tone: 'warn',
      detail: `Expires on ${expires.toLocaleDateString()}.`,
    };
  }
  return {
    label: 'Issued',
    tone: 'ok',
    detail: `Expires on ${expires.toLocaleDateString()}.`,
  };
}

/** Whether the server has been told to answer for this hostname. */
export function routingReading(domain: Domain): StatusReading {
  switch (domain.state) {
    case 'routing_active':
    case 'tls_pending':
    case 'active':
      return { label: 'Routed', tone: 'ok' };
    case 'degraded':
      return {
        label: 'Routed',
        tone: 'warn',
        detail: domain.state_detail,
      };
    case 'routing_pending':
      return { label: 'Being written', tone: 'warn' };
    case 'failed':
      return { label: 'Failed', tone: 'bad', detail: domain.last_error ?? domain.state_detail };
    case 'detached':
      return { label: 'Removed', tone: 'muted' };
    default:
      return { label: 'Not routed yet', tone: 'muted' };
  }
}

/** Whether a visitor typing the hostname reaches the Service. */
export function servingReading(domain: Domain): StatusReading {
  return domain.serving
    ? { label: 'Serving', tone: 'ok' }
    : { label: 'Not serving', tone: 'muted', detail: domain.state_detail };
}

/** What an Operator can do about a domain that is not serving. */
export interface Remediation {
  /** Which call the button runs. Both are explicit Operator actions. */
  kind: 'verify' | 'provision';
  label: string;
  /** What the button will do, said before it is pressed. */
  explanation: string;
}

/**
 * The one thing to do next, or nothing.
 *
 * There is no standalone certificate re-issue call, so a certificate that did
 * not issue is remediated by running provisioning again. The copy says that
 * plainly instead of offering a "Reissue certificate" button that is really
 * something else.
 */
export function remediationFor(domain: Domain): Remediation | null {
  if (domain.state === 'detached') {
    return null;
  }
  if (domain.state === 'pending_dns' || domain.state === 'dns_verifying') {
    return {
      kind: 'verify',
      label: 'Check DNS now',
      explanation:
        'SlideOps looks the hostname up for real and records what answered. Nothing on any server changes.',
    };
  }
  if (domain.tls_state === 'failed') {
    return {
      kind: 'provision',
      label: 'Run provisioning again',
      explanation:
        'There is no separate certificate retry: provisioning is what requests one. Running it again opens the web ports, rewrites the route for this hostname, and asks for the certificate once more.',
    };
  }
  if (
    domain.state === 'dns_verified' ||
    domain.state === 'routing_pending' ||
    domain.state === 'failed' ||
    domain.state === 'degraded'
  ) {
    return {
      kind: 'provision',
      label: 'Put it live',
      explanation:
        'Opens the web ports, writes the route for this hostname only, and requests a certificate. Other sites on the same server are left alone.',
    };
  }
  return null;
}

/** The states a domain can only be in once DNS has been seen to point here. */
const POST_DNS_STATES: DomainState[] = [
  'dns_verified',
  'routing_pending',
  'routing_active',
  'tls_pending',
  'active',
  'degraded',
];

/**
 * Whether DNS has actually been seen pointing at the expected target.
 *
 * Either the backend moved the domain past the DNS stage, or the resolver
 * answered with the exact value the record was supposed to carry. A domain that
 * has never been checked is not verified, and neither is one that failed.
 */
export function dnsVerified(domain: Domain): boolean {
  if (POST_DNS_STATES.includes(domain.state)) {
    return true;
  }
  return Boolean(domain.dns_observed) && domain.dns_observed === domain.record.value;
}

/** Whether the route for this hostname exists on the server that serves it. */
export function routeWritten(domain: Domain): boolean {
  return (
    domain.state === 'routing_active' ||
    domain.state === 'tls_pending' ||
    domain.state === 'active' ||
    domain.state === 'degraded'
  );
}

export type GroupMode = 'none' | 'node' | 'service' | 'status';

/** The names a domain's ids stand for, joined in from the Services and Nodes. */
export interface DomainNames {
  service: Map<string, string>;
  node: Map<string, string>;
}

export function serviceNameOf(domain: Domain, names: DomainNames): string {
  return names.service.get(domain.service_id) ?? 'Unknown Service';
}

export function nodeNameOf(domain: Domain, names: DomainNames): string {
  if (!domain.node_id) {
    return 'No server yet';
  }
  return names.node.get(domain.node_id) ?? 'Unknown server';
}

export interface DomainFilter {
  query: string;
  /** A DomainState, or every state. */
  state: DomainState | 'all';
  nodeId: string | 'all';
  serviceId: string | 'all';
}

export const EMPTY_FILTER: DomainFilter = {
  query: '',
  state: 'all',
  nodeId: 'all',
  serviceId: 'all',
};

/**
 * Narrow the list. The search matches the hostname and the names it is joined
 * to, because "which of these is the billing app" is asked far more often than
 * "which of these is called billing.example.com".
 */
export function filterDomains(
  domains: Domain[],
  filter: DomainFilter,
  names: DomainNames,
): Domain[] {
  const query = filter.query.trim().toLowerCase();
  return domains.filter((domain) => {
    if (filter.state !== 'all' && domain.state !== filter.state) {
      return false;
    }
    if (filter.nodeId !== 'all' && (domain.node_id ?? '') !== filter.nodeId) {
      return false;
    }
    if (filter.serviceId !== 'all' && domain.service_id !== filter.serviceId) {
      return false;
    }
    if (query === '') {
      return true;
    }
    const haystack = [
      domain.hostname,
      serviceNameOf(domain, names),
      nodeNameOf(domain, names),
    ]
      .join(' ')
      .toLowerCase();
    return haystack.includes(query);
  });
}

export interface DomainGroup {
  key: string;
  label: string;
  domains: Domain[];
}

/**
 * Gather the list under a heading.
 *
 * Grouping by server matters most: several Services commonly share one server,
 * each with its own hostname, and the question "what does this box answer for"
 * has no other answer on any screen.
 */
export function groupDomains(
  domains: Domain[],
  mode: GroupMode,
  names: DomainNames,
): DomainGroup[] {
  if (mode === 'none') {
    return [{ key: 'all', label: 'All domains', domains }];
  }

  const groups = new Map<string, DomainGroup>();
  for (const domain of domains) {
    const { key, label } =
      mode === 'node'
        ? { key: domain.node_id ?? 'unassigned', label: nodeNameOf(domain, names) }
        : mode === 'service'
          ? { key: domain.service_id, label: serviceNameOf(domain, names) }
          : { key: domain.state, label: stateLabel(domain.state) };

    const existing = groups.get(key);
    if (existing) {
      existing.domains.push(domain);
    } else {
      groups.set(key, { key, label, domains: [domain] });
    }
  }

  return [...groups.values()].sort((a, b) => a.label.localeCompare(b.label));
}

/** Every server that has at least one domain on it, for the routing check. */
export function nodeIdsWithDomains(domains: Domain[]): string[] {
  const ids = new Set<string>();
  for (const domain of domains) {
    if (domain.node_id) {
      ids.add(domain.node_id);
    }
  }
  return [...ids];
}
