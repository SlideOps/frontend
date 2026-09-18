import { apiRequest } from './http';

/*
 * Discovering and validating a Celery worker, before an Operator ever
 * approves anything.
 *
 * Both endpoints below are read only and need no approval, the same reasoning
 * getAvailableVersions already uses for a live, pre-submission SSH check
 * outside the Operation pipeline entirely: a candidate picker and a "does
 * this actually work" checklist cannot live inside a Plan, since Plan never
 * gets a connection on the backend. configure-celery-worker itself is an
 * ordinary Capability, started through createOperation like any other, once
 * one of these has found and proven a candidate.
 */

/** One candidate Celery application discovery found under a scanned path. */
export interface CeleryCandidate {
  /** module:attribute, exactly the shape celery_app itself takes. */
  target: string;
  /** Where it was found, relative to the scanned path. */
  file: string;
}

/** Everything a scan of an application directory found. */
export interface CeleryDiscovery {
  candidates: CeleryCandidate[];
  python_candidates: string[];
  has_pyproject_toml: boolean;
  has_requirements_txt: boolean;
  has_pipfile: boolean;
  has_poetry_lock: boolean;
  has_uv_lock: boolean;
}

/**
 * Scan a path on the Service's own Node for candidate Celery applications,
 * candidate Python interpreters, and dependency manifests. Read only:
 * nothing about the Node changes. Candidates are offered, never chosen --
 * preflightCelery is what actually proves one works.
 */
export function discoverCelery(
  serviceId: string,
  path: string,
  signal?: AbortSignal,
): Promise<CeleryDiscovery> {
  return apiRequest<{ discovery: CeleryDiscovery }>(
    `/services/${encodeURIComponent(serviceId)}/celery/discover`,
    { method: 'POST', body: { path }, signal },
  ).then((r) => r.discovery);
}

/** The configuration a preflight (or an eventual configure) validates. */
export interface CeleryPreflightInput {
  working_directory: string;
  python_executable: string;
  celery_app: string;
  broker_url: string;
  result_backend?: string;
}

/** One preflight check and the real evidence behind it, pass or fail. */
export interface CeleryCheck {
  name: string;
  passed: boolean;
  detail: string;
}

/**
 * Validate a Celery worker configuration before ever configuring it. Runs
 * the exact same checks configure-celery-worker's own Execute and Verify
 * run, live, against the Service's own Node -- so a check passing here can
 * never mean something subtly different from what approving it would check.
 * Every failing check carries the real underlying error, never a generic
 * failure.
 */
export function preflightCelery(
  serviceId: string,
  input: CeleryPreflightInput,
  signal?: AbortSignal,
): Promise<CeleryCheck[]> {
  return apiRequest<{ checks: CeleryCheck[] }>(
    `/services/${encodeURIComponent(serviceId)}/celery/preflight`,
    { method: 'POST', body: input, signal },
  ).then((r) => r.checks ?? []);
}

/** What sendCeleryTestTask needs to send a real task to the queue this
 * worker is configured to consume. */
export interface CeleryTestTaskInput {
  working_directory: string;
  python_executable: string;
  celery_app: string;
  result_backend: string;
  queues: string;
}

/**
 * Send celery.backend_cleanup -- a task every Celery application always has,
 * never one assumed from the application's own code -- through the broker
 * to the queue this worker is configured to consume, and wait for the
 * result backend to report it finished. This is the one thing a control
 * ping cannot prove: that a task enqueued the way the application enqueues
 * it is actually picked up, executed, and its result read back. Requires a
 * result backend; without one the check says so rather than reporting a
 * false pass.
 */
export function sendCeleryTestTask(
  serviceId: string,
  input: CeleryTestTaskInput,
  signal?: AbortSignal,
): Promise<CeleryCheck> {
  return apiRequest<{ check: CeleryCheck }>(
    `/services/${encodeURIComponent(serviceId)}/celery/test-task`,
    { method: 'POST', body: input, signal },
  ).then((r) => r.check);
}
