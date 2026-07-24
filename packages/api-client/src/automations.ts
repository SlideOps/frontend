import { apiRequest, unwrap } from './http';

/*
 * The Automations surface. An Automation is a saved intent to run a Capability
 * on a Node on a recurring schedule. Setting one up is the Operator's standing
 * approval for those runs, so scheduled Operations are auto-approved, yet they
 * still run the full lifecycle and always produce History. Field names mirror
 * the backend contract exactly so the wire shape and the type never drift.
 */

/**
 * A small, explicit recurrence. `time` is UTC HH:MM for daily and up, `weekday`
 * is 0 (Sunday) to 6 (Saturday) for weekly, and `day_of_month` is 1 to 28 for
 * monthly. Hourly needs none of them.
 */
export interface Schedule {
  frequency: 'hourly' | 'daily' | 'weekly' | 'monthly';
  time?: string;
  weekday?: number;
  day_of_month?: number;
}

/**
 * An Automation. Secret parameters are stored through the secrets abstraction
 * and are redacted in API responses, never returned inline.
 */
export interface Automation {
  id: string;
  operator_id: string;
  node_id: string;
  capability_key: string;
  parameters?: Record<string, unknown>;
  schedule: Schedule;
  enabled: boolean;
  last_run_at: string | null;
  next_run_at: string | null;
  last_operation_id: string | null;
  created_at: string;
  updated_at?: string;
}

/** The fields required to create an Automation. */
export interface CreateAutomationInput {
  node_id: string;
  capability_key: string;
  parameters?: Record<string, unknown>;
  schedule: Schedule;
  enabled?: boolean;
}

/** The fields an Operator may change on an existing Automation. */
export interface UpdateAutomationInput {
  schedule?: Schedule;
  parameters?: Record<string, unknown>;
  enabled?: boolean;
}

/** List the Operator's Automations. */
export function listAutomations(signal?: AbortSignal): Promise<Automation[]> {
  return apiRequest<unknown>('/automations', { signal }).then((r) =>
    unwrap<Automation[]>(r, 'automations'),
  );
}

/** Read one Automation by its id. */
export function getAutomation(id: string, signal?: AbortSignal): Promise<Automation> {
  return apiRequest<unknown>(`/automations/${id}`, { signal }).then((r) =>
    unwrap<Automation>(r, 'automation'),
  );
}

/** Create an Automation. The response carries the computed next_run_at. */
export function createAutomation(input: CreateAutomationInput): Promise<Automation> {
  return apiRequest<unknown>('/automations', { method: 'POST', body: input }).then((r) =>
    unwrap<Automation>(r, 'automation'),
  );
}

/** Update an Automation's schedule, parameters, or enabled state. */
export function updateAutomation(id: string, input: UpdateAutomationInput): Promise<Automation> {
  return apiRequest<unknown>(`/automations/${id}`, { method: 'PATCH', body: input }).then((r) =>
    unwrap<Automation>(r, 'automation'),
  );
}

/** Delete an Automation. Its past Operations stay in History. */
export function deleteAutomation(id: string): Promise<void> {
  return apiRequest<void>(`/automations/${id}`, { method: 'DELETE' });
}

/**
 * Trigger one run now. The run is still auto-approved and runs the full
 * lifecycle. The id of the created Operation is returned so the caller can open
 * it.
 */
export function runAutomation(id: string): Promise<string> {
  return apiRequest<{ operation_id: string }>(`/automations/${id}/run`, { method: 'POST' }).then(
    (r) => r.operation_id,
  );
}
