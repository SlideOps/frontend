/*
 * The typed wire shapes for the Phase 1 core loop. Field names mirror the
 * backend contract exactly so the wire shape and the type never drift. They use
 * the ubiquitous language: Operator, Project, Node, Capability, Operation, Plan,
 * Verification, Facts, Assessment.
 */

/**
 * An Operator account, as returned by the auth endpoints. Field names mirror
 * the backend contract exactly so the wire shape and the type never drift.
 */
export interface Operator {
  id: string;
  email: string;
  mfa_enabled: boolean;
  created_at: string;
}

/**
 * An Admin account. Admins sign in through the separate control-plane surface
 * and cannot self register. The shape mirrors the backend contract.
 */
export interface Admin {
  id: string;
  email: string;
  mfa_enabled: boolean;
  created_at: string;
}

/** A Project groups related Nodes. It carries no secrets. */
export interface Project {
  id: string;
  name: string;
  description: string;
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
 * A Capability is technology independent metadata: what outcome it delivers,
 * where it applies, and how risky it is. The catalog exposes these.
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
  os?: { id?: string; version?: string; pretty_name?: string };
  kernel?: string;
  package_manager?: string;
  packages?: string[];
  services?: string[];
  listening_ports?: string[];
  cpu?: { model?: string; cores?: number };
  memory?: { total?: string; used?: string };
  disk?: { total?: string; used?: string };
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
  reason: string;
}

/** Assessment interprets Facts into plain-language findings and recommendations. */
export interface Assessment {
  summary: string;
  findings: AssessmentFinding[];
  recommendations: AssessmentRecommendation[];
}

/** The result of POST /nodes/{id}/discover. */
export interface DiscoveryResult {
  facts: Facts;
  assessment: Assessment;
}
