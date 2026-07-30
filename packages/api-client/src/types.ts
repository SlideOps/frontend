/*
 * The typed wire shapes for the Phase 1 core loop. Field names mirror the
 * backend contract exactly so the wire shape and the type never drift. They use
 * the ubiquitous language: Operator, Project, Node, Capability, Operation, Plan,
 * Verification, Facts, Assessment.
 */

/**
 * The role an Operator account carries. Every account is an Operator; `admin`
 * additionally grants access to the control-plane routes under /admin. There is
 * no separate Admin account type anymore, only this role on the one account.
 */
export type OperatorRole = 'operator' | 'admin';

/**
 * An Operator account, as returned by the auth endpoints. Field names mirror
 * the backend contract exactly so the wire shape and the type never drift. The
 * `role` distinguishes a plain Operator from one with admin access.
 */
export interface Operator {
  id: string;
  email: string;
  role: OperatorRole;
  mfa_enabled: boolean;
  /**
   * Whether this account can sign in with a password at all. An account created
   * through GitHub has none, so it has no password to change and must not be
   * offered a form that could never succeed.
   */
  has_password: boolean;
  created_at: string;
}

/** A Project groups related Nodes. It carries no secrets. */
export interface Project {
  id: string;
  name: string;
  description: string;
  /**
   * The domain requests reach this Project by, a lowercase hostname like
   * `app.example.com`. Empty when the Project has no domain set yet. Setting one
   * lets the Operator point DNS at this Project's server and route by name.
   */
  domain: string;
  created_at: string;
  updated_at?: string;
}

/** How a Node authenticates over SSH. */
export type NodeAuthKind = 'password' | 'private_key';

/**
 * A Node is one Linux machine reached over SSH. The API never returns the
 * credential; only the auth kind and the connection summary are exposed.
 */
export interface Node {
  id: string;
  name: string;
  hostname: string;
  address: string;
  port: number;
  ssh_username: string;
  auth_kind: NodeAuthKind;
  project_id: string | null;
  os: string | null;
  distro: string | null;
  distro_version: string | null;
  status: string;
  tags: string[];
  last_discovered_at: string | null;
  created_at: string;
}

/** The risk a Capability or a plan step carries. */
export type RiskLevel = 'low' | 'medium' | 'high';

/**
 * The input type of a Capability parameter. The frontend reads this to render
 * the right control and the right validation: a single line, a multi-line text
 * area, a number, a boolean toggle, a domain name, an absolute path, or an SSH
 * public key. Types stay open ended so a new one never breaks rendering.
 */
export type CapabilityParameterType =
  'string' | 'text' | 'number' | 'boolean' | 'domain' | 'path' | 'public_key';

/**
 * One input a Capability needs before it can run, described in metadata so the
 * frontend generates the form and the Provider reads the value. The label and
 * help are plain-language, the placeholder is an example the Operator can copy.
 */
export interface CapabilityParameter {
  key: string;
  label: string;
  type: CapabilityParameterType;
  required: boolean;
  help: string;
  placeholder?: string;
}

/**
 * A configuration prerequisite a Capability needs before it works: a connected
 * account, a domain, a destination. It is not another Capability; it names
 * something the Operator sets up, why, and how, with an optional Capability or
 * app path that sets it up.
 */
export interface CapabilityRequirement {
  kind: string;
  title: string;
  description: string;
  how_to: string;
  setup_capability_key?: string;
  setup_path?: string;
}

/**
 * A Capability is technology independent metadata: what outcome it delivers,
 * where it applies, how risky it is, and any inputs it needs. The catalog
 * exposes these.
 */
export interface Capability {
  key: string;
  name: string;
  category: string;
  description: string;
  intent?: string;
  risk_level: RiskLevel;
  supported_platforms?: string[];
  verification_strategy?: string;
  /** The inputs this Capability needs. Empty when it needs none. */
  parameters?: CapabilityParameter[];
  /** Configuration prerequisites to set up before this works. Empty when none. */
  requirements?: CapabilityRequirement[];
  /**
   * The Plugin this Capability comes from. Core Capabilities carry no Plugin
   * source (or report `core`); a Capability unlocked by an installed Plugin
   * names it here so the catalog can show where it came from.
   */
  plugin_id?: string;
  /** A plain-language name for the Plugin source, when the backend provides it. */
  source?: string;
}

/** One step of a Plan: what it does, why, and how risky it is. */
export interface PlanStep {
  id: string;
  title: string;
  description: string;
  risk: RiskLevel;
  effect: string;
}

/**
 * A Plan is the reviewable proposal an Operator approves before anything runs:
 * the ordered steps, the risks in plain language, the rollback, and how the
 * result will be verified.
 */
export interface Plan {
  steps: PlanStep[];
  risks: string[];
  rollback: string;
  verification_strategy: string;
}

/** One verification check and its evidence. */
export interface VerificationCheck {
  name: string;
  passed: boolean;
  detail: string;
}

/** The Verification result: whether every check passed, with the evidence. */
export interface Verification {
  passed: boolean;
  checks: VerificationCheck[];
}

/**
 * The Operation lifecycle. Discovery, assessment, and planning run on the
 * server so an Operation reaches awaiting_approval with a Plan attached.
 */
export type OperationStatus =
  | 'created'
  | 'discovering'
  | 'assessing'
  | 'planning'
  | 'awaiting_approval'
  | 'approved'
  | 'executing'
  | 'verifying'
  | 'completed'
  | 'failed'
  | 'cancelled';

/** The kinds of realtime message the stream carries for an Operation. */
export type OperationEventType =
  | 'operation.status'
  | 'operation.log'
  | 'operation.step'
  | 'operation.verification'
  | 'operation.completed';

/** The severity attached to an event line. */
export type EventLevel = 'info' | 'warn' | 'error';

/**
 * One realtime event for an Operation. Events are persisted and replayed by
 * GET /operations/{id}, and published live over the websocket, both in the same
 * shape so a client can replay then subscribe without a seam. `seq` orders and
 * de-duplicates them.
 */
export interface OperationEvent {
  operation_id: string;
  seq: number;
  at: string;
  type: OperationEventType;
  level: EventLevel;
  message: string;
  data: Record<string, unknown>;
}

/**
 * An Operation: one run of a Capability against a Node, from plan to
 * verification. `events` is present when read through GET /operations/{id}.
 */
export interface Operation {
  id: string;
  node_id: string;
  capability_key: string;
  status: OperationStatus;
  plan: Plan | null;
  verification: Verification | null;
  error: string | null;
  /** The parameter values supplied at creation, with any secret values redacted. */
  parameters?: Record<string, unknown>;
  created_at: string;
  approved_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  events?: OperationEvent[];
}

/**
 * The Facts gathered by read-only Discovery. The backend serializes a typed
 * struct to jsonb; the shape here names the fields Phase 1 gathers while
 * staying open to extra keys so new Facts never break rendering.
 */
export interface Facts {
  os?: { id?: string; version?: string; version_id?: string; name?: string; pretty_name?: string };
  kernel?: string;
  package_manager?: string;
  service_manager?: string;
  pending_updates?: number;
  packages?: string[];
  services?: string[];
  listening_ports?: string[];
  cpu?: { model?: string; cores?: number };
  /**
   * The installed memory. `total_kb` is the machine-readable size Discovery
   * saves; `total`/`used` are the older human strings. Kept side by side so the
   * capacity view can read the number without breaking any existing reader.
   */
  memory?: { total?: string; used?: string; total_kb?: number };
  disk?: { total?: string; used?: string };
  /**
   * Each mounted filesystem. `size_kb`/`used_kb`/`avail_kb`/`use_percent` are the
   * machine-readable fields Discovery saves (mirroring df), added beside the
   * older `device`/`total`/`used`/`mount` strings so no existing reader breaks.
   */
  disks?: Array<{
    device?: string;
    total?: string;
    used?: string;
    mount?: string;
    filesystem?: string;
    mount_point?: string;
    size_kb?: number;
    used_kb?: number;
    avail_kb?: number;
    use_percent?: number | string;
  }>;
  containers?: { docker_present?: boolean; runtime?: string };
  firewall?: { backend?: string; active?: boolean };
  web_servers?: { caddy_present?: boolean; nginx_present?: boolean };
  git?: { present?: boolean; version?: string };
  databases?: Array<{ engine?: string; version?: string; running?: boolean }>;
  tls?: { lets_encrypt_present?: boolean; certificate_names?: string[] };
  human_accounts?: number;
  ssh?: {
    connected_auth_kind?: string;
    permit_root_login?: string;
    password_authentication?: boolean;
    x11_forwarding?: boolean;
    max_auth_tries?: number;
    effective_config?: Record<string, string>;
    [key: string]: unknown;
  };
  sshd_config?: Record<string, string>;
  ssh_posture?: {
    permit_root_login?: string;
    password_authentication?: string;
    [key: string]: string | undefined;
  };
  [key: string]: unknown;
}

/** One plain-language finding from Assessment. */
export interface AssessmentFinding {
  title: string;
  detail: string;
  severity?: RiskLevel | string;
}

/** A Capability recommended by Assessment, with the reason it applies. */
export interface AssessmentRecommendation {
  capability_key: string;
  title?: string;
  reason: string;
}

/** One plain-language line of what the Node already has, grouped by category. */
export interface AssessmentInventoryItem {
  category: string;
  detail: string;
}

/** Assessment interprets Facts into plain-language findings and recommendations. */
export interface Assessment {
  summary: string;
  inventory?: AssessmentInventoryItem[];
  findings: AssessmentFinding[];
  recommendations: AssessmentRecommendation[];
}

/** The result of POST /nodes/{id}/discover. */
export interface DiscoveryResult {
  facts: Facts;
  assessment: Assessment;
}
