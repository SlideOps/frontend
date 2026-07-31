import { apiRequest, unwrap } from './http';
import type { CapabilityParameter } from './types';

/*
 * What can be done to a Capability that is already installed.
 *
 * An Action is not a Capability. A Capability is an intent to change a server and
 * runs through the whole lifecycle; asking which databases exist is a question.
 * `effect` is what separates them, and it decides whether the platform asks
 * before running something.
 */

/** How consequential an Action is, and therefore how it runs. */
export type ActionEffect = 'read' | 'write' | 'destructive';

/** What a read Action gives back, so the screen knows how to show it. */
export type ActionProduces = 'table' | 'file';

/** One thing an Operator can do to an installed Capability. */
export interface CapabilityAction {
  key: string;
  label: string;
  description: string;
  effect: ActionEffect;
  produces?: ActionProduces;
  parameters: CapabilityParameter[];
}

/** Rows returned by a read Action. */
export interface ActionTable {
  columns: string[];
  rows: string[][];
  /** What it means that there is nothing here, in the Operator's language. */
  empty?: string;
}

/** What this Capability offers once installed. Empty for most of them. */
export function listCapabilityActions(
  capabilityKey: string,
  signal?: AbortSignal,
): Promise<CapabilityAction[]> {
  return apiRequest(`/capabilities/${encodeURIComponent(capabilityKey)}/actions`, { signal }).then(
    (r) => unwrap<CapabilityAction[]>(r, 'actions'),
  );
}

/** Run a read Action against a Node and get its rows. Changes nothing. */
export function runCapabilityAction(
  capabilityKey: string,
  actionKey: string,
  input: { node_id: string; service_id?: string; parameters?: Record<string, string> },
): Promise<ActionTable> {
  return apiRequest(
    `/capabilities/${encodeURIComponent(capabilityKey)}/actions/${encodeURIComponent(actionKey)}`,
    { method: 'POST', body: input },
  ).then((r) => unwrap<ActionTable>(r, 'table'));
}

/**
 * The URL a file producing Action downloads from.
 *
 * A URL rather than a fetch, so the browser downloads it the way it downloads
 * anything: streamed to disk, with a progress indicator, and without the whole
 * file passing through JavaScript memory first. A database dump can be larger
 * than the tab can hold.
 */
export function capabilityActionDownloadUrl(
  capabilityKey: string,
  actionKey: string,
  input: { node_id: string; service_id?: string; parameters?: Record<string, string> },
): string {
  const query = new URLSearchParams({
    node_id: input.node_id,
    // Scoping the download too, or a Service page would hand somebody a copy of
    // another application's database simply by typing its name.
    ...(input.service_id ? { service_id: input.service_id } : {}),
    ...(input.parameters ?? {}),
  });
  return `/api/v1/capabilities/${encodeURIComponent(capabilityKey)}/actions/${encodeURIComponent(actionKey)}/download?${query}`;
}
