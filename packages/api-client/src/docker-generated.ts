/*
 * Generated from the Go types this API actually sends. Do not edit by hand.
 *
 * Regenerate with "make ts-types" in the backend repository and commit the
 * result here. The two repositories are separate, so this file is the seam
 * between them, and a change to a Go struct that is not reflected here is a
 * change the browser does not know about yet.
 *
 * Every list is "T[] | null" because Go marshals a nil slice as null rather
 * than as an empty array, and every field carrying omitempty is optional
 * because that is exactly what omitempty means. Both are inconvenient to read
 * and both are true, which is the point: the inconvenience is the contract
 * being honest about what may not arrive.
 */

export interface CleanupPlan {
  kind: string;
  item_count: number;
  targets: string[] | null;
  reclaimable_bytes: number;
  requires_data_loss_confirmation: boolean;
}

export interface CleanupResult {
  kind: string;
  planned: CleanupPlan;
  removed: string[] | null;
  reclaimed_bytes: number;
}

export interface ComposeApplyResult {
  project: string;
  path: string;
  diff: ComposeDiff;
  backup_path?: string;
  command: string;
  output?: string;
  state: ComposeProject;
}

export interface ComposeDiff {
  services_added: string[] | null;
  services_removed: string[] | null;
  services_changed: ComposeServiceChange[] | null;
  recreated: string[] | null;
  networks_added: string[] | null;
  networks_removed: string[] | null;
  volumes_added: string[] | null;
  volumes_removed: ComposeVolumeChange[] | null;
  affects_data: boolean;
  warnings: string[] | null;
}

export interface ComposeFieldChange {
  field: string;
  from: string;
  to: string;
}

export interface ComposeFileContent {
  project: string;
  path: string;
  content: string;
  truncated: boolean;
  editable: boolean;
}

export interface ComposeFileIssue {
  line?: number;
  message: string;
}

export interface ComposeProject {
  name: string;
  ownership: string;
  status?: string;
  config_files: string[] | null;
  working_dir?: string;
  config_readable: boolean;
  containers: number;
  running: number;
  services: ComposeProjectService[] | null;
  images: string[] | null;
  networks: string[] | null;
  volumes: string[] | null;
  found_by: string;
}

export interface ComposeProjectService {
  name: string;
  containers: number;
  running: number;
  state: string;
  health?: string;
  image?: string;
  ports: PortMapping[] | null;
}

export interface ComposeRequest {
  action: string;
  services?: string[] | null;
  remove_volumes?: boolean;
  confirm_data_loss?: boolean;
}

export interface ComposeResult {
  project: string;
  action: string;
  command: string;
  output?: string;
  state: ComposeProject;
}

export interface ComposeServiceChange {
  name: string;
  changes: ComposeFieldChange[] | null;
  recreated: boolean;
}

export interface ComposeValidation {
  valid: boolean;
  issues: ComposeFileIssue[] | null;
  checked_on_node: boolean;
}

export interface ComposeVolumeChange {
  name: string;
  exists_on_node: boolean;
  node_volume?: string;
}

export interface Container {
  full_id: string;
  id: string;
  name: string;
  image: string;
  image_id?: string;
  state: string;
  status_text?: string;
  health?: string;
  created_at?: string;
  started_at?: string;
  restart_count: number;
  exit_code: number;
  restart_policy?: string;
  ports: PortMapping[] | null;
  compose_project?: string;
  compose_service?: string;
  ownership: string;
  service_id?: string;
  cpu_limit_cores: number;
  memory_limit_mb: number;
  networks: string[] | null;
  mount_count: number;
  labels?: Record<string, string> | null;
}

export interface Counts {
  containers: number;
  running: number;
  stopped: number;
  paused: number;
  restarting: number;
  unhealthy: number;
  exited: number;
  dead: number;
  created: number;
  images: number;
  volumes: number;
  networks: number;
  compose_projects: number;
}

export interface CrashAnalysis {
  container_ref: string;
  container_id?: string;
  container_name?: string;
  found: boolean;
  state?: string;
  running: boolean;
  restart_count: number;
  last_restart_at?: string;
  previous_state?: string;
  exit_code: number;
  exit_code_known: boolean;
  oom_killed: boolean;
  health?: string;
  health_failing_streak?: number;
  restart_loop: boolean;
  deaths_in_window: number;
  crash_loop_window_seconds: number;
  events_read: boolean;
  events_found: number;
  event_window_seconds: number;
  observations: Observation[] | null;
  logs: LogReference;
  analyzed_at: string;
}

export interface CreatedContainer {
  full_id: string;
  id: string;
  name?: string;
  output?: string;
}

export interface Daemon {
  available: boolean;
  version?: string;
  api_version?: string;
  storage_driver?: string;
  cgroup_driver?: string;
  kernel?: string;
  architecture?: string;
  warnings: string[] | null;
}

export interface DependencyEdge {
  from: string;
  to: string;
  condition?: string;
}

export interface DependencyGraph {
  services: string[] | null;
  edges: DependencyEdge[] | null;
  order: string[] | null;
  cycle: string[] | null;
  missing: string[] | null;
}

export interface DiskCategory {
  count: number;
  active: number;
  bytes_total: number;
  bytes_reclaimable: number;
}

export interface DiskUsage {
  images: DiskCategory;
  containers: DiskCategory;
  volumes: DiskCategory;
  build_cache: DiskCategory;
}

export interface Event {
  type: string;
  action: string;
  detail?: string;
  actor_id?: string;
  actor_name?: string;
  attributes?: Record<string, string> | null;
  at: string;
}

export interface HealthcheckRequest {
  command: string;
  interval_seconds?: number;
  timeout_seconds?: number;
  retries?: number;
  start_period_seconds?: number;
}

export interface Image {
  id: string;
  repository: string;
  tag: string;
  created_at?: string;
  size_bytes: number;
  dangling: boolean;
  in_use: boolean;
  containers: number;
}

export interface ImageDetail {
  id: string;
  reference: string;
  repo_tags: string[] | null;
  repo_digests: string[] | null;
  created_at?: string;
  size_bytes: number;
  os?: string;
  architecture?: string;
  entrypoint: string[] | null;
  command: string[] | null;
  labels?: Record<string, string> | null;
  containers: string[] | null;
}

export interface ImageRemoval {
  untagged: string[] | null;
  deleted: string[] | null;
}

export interface Inspect {
  general: InspectGeneral;
  configuration: InspectConfiguration;
  resources: InspectResources;
  networking: InspectNetworking;
  storage: InspectStorage;
  runtime: InspectRuntime;
}

export interface InspectConfiguration {
  image: string;
  image_id?: string;
  command: string[] | null;
  entrypoint: string[] | null;
  working_dir?: string;
  user?: string;
  labels?: Record<string, string> | null;
  compose_project?: string;
  compose_service?: string;
}

export interface InspectGeneral {
  full_id: string;
  id: string;
  name: string;
  created_at?: string;
  state: string;
  status_text?: string;
  platform?: string;
  runtime?: string;
  storage_driver?: string;
  ownership: string;
  service_id?: string;
}

export interface InspectHealthResult {
  exit_code: number;
  started_at?: string;
  ended_at?: string;
}

export interface InspectHealthcheck {
  test?: string[] | null;
  interval_seconds?: number;
  timeout_seconds?: number;
  start_period_seconds?: number;
  retries?: number;
}

export interface InspectMount {
  type: string;
  name?: string;
  source?: string;
  destination: string;
  read_only: boolean;
  driver?: string;
}

export interface InspectNetwork {
  name: string;
  ip_address?: string;
  gateway?: string;
  mac_address?: string;
  aliases?: string[] | null;
}

export interface InspectNetworking {
  hostname?: string;
  networks: InspectNetwork[] | null;
  ports: PortMapping[] | null;
  dns: string[] | null;
}

export interface InspectResources {
  cpu_limit_cores: number;
  cpu_shares: number;
  cpuset_cpus?: string;
  memory_limit_mb: number;
  memory_reservation_mb: number;
  pids_limit: number;
}

export interface InspectRuntime {
  restart_policy: string;
  restart_max_retries: number;
  restart_count: number;
  health?: string;
  health_failing_streak: number;
  healthcheck?: InspectHealthcheck;
  last_health_result?: InspectHealthResult;
  oom_killed: boolean;
  pid: number;
  exit_code: number;
  started_at?: string;
  finished_at?: string;
}

export interface InspectStorage {
  mounts: InspectMount[] | null;
}

export interface LogReference {
  container_ref: string;
  since?: string;
  until?: string;
  tail?: number;
  command: string;
}

export interface MetricSample {
  workspace_id: string;
  node_id: string;
  container_id: string;
  container_name?: string;
  cpu_percent: number;
  memory_used_mb: number;
  memory_limit_mb: number;
  net_rx_bytes: number;
  net_tx_bytes: number;
  sampled_at: string;
}

export interface MountRequest {
  type: string;
  source?: string;
  target: string;
  read_only?: boolean;
}

export interface Network {
  id: string;
  name: string;
  driver: string;
  scope: string;
  subnet?: string;
  gateway?: string;
  internal: boolean;
  containers: string[] | null;
  labels?: Record<string, string> | null;
}

export interface Observation {
  kind: string;
  summary: string;
  evidence: string[] | null;
}

export interface Overview {
  daemon: Daemon;
  counts: Counts;
  disk: DiskUsage;
}

export interface PortMapping {
  host_ip?: string;
  host_port: number;
  container_port: number;
  protocol: string;
}

export interface PortRequest {
  host_ip?: string;
  host_port: number;
  container_port: number;
  protocol?: string;
}

export interface PullProgress {
  kind: string;
  layer?: string;
  status?: string;
  message?: string;
  current_bytes?: number;
  total_bytes?: number;
  percent: number;
}

export interface PullResult {
  reference: string;
  digest?: string;
  status?: string;
  up_to_date: boolean;
  layers: number;
}

export interface RunRequest {
  image: string;
  name?: string;
  ports?: PortRequest[] | null;
  env?: Record<string, string> | null;
  mounts?: MountRequest[] | null;
  restart_policy?: string;
  command?: string[] | null;
  entrypoint?: string;
  working_dir?: string;
  user?: string;
  cpu_limit_cores?: number;
  memory_limit_mb?: number;
  network?: string;
  dns?: string[] | null;
  labels?: Record<string, string> | null;
  healthcheck?: HealthcheckRequest;
  privileged?: boolean;
}

export interface Stats {
  container_id: string;
  container_name?: string;
  cpu_percent: number;
  memory_used_mb: number;
  memory_limit_mb: number;
  net_rx_bytes: number;
  net_tx_bytes: number;
  block_read_bytes: number;
  block_write_bytes: number;
  pids: number;
}

export interface Volume {
  name: string;
  driver: string;
  mountpoint?: string;
  created_at?: string;
  size_bytes: number;
  in_use: boolean;
  containers: string[] | null;
  labels?: Record<string, string> | null;
}
