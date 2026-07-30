import { apiRequest } from './http';

/*
 * Reports are generated on read from stored Operations, verifications,
 * discoveries, and metrics. The backend returns structured JSON the frontend
 * renders; a plain-text or markdown rendering may accompany it. The shape stays
 * tolerant so a new section or field never breaks rendering.
 */

/** The kinds of report an Operator can generate. */
export type ReportType = 'verification' | 'health' | 'inventory' | 'operations' | 'security';

/** One labelled value inside a report section, for a simple key and value row. */
export interface ReportRow {
  label: string;
  value: string;
}

/**
 * One section of a report. A section may carry rows (label and value pairs),
 * items (a plain list), free text, or a table (headers plus rows of cells).
 * All are optional so the frontend renders whichever the backend supplies.
 */
export interface ReportSection {
  title: string;
  summary?: string;
  rows?: ReportRow[];
  items?: string[];
  text?: string;
  table?: {
    headers: string[];
    rows: string[][];
  };
}

/** A generated report. The sections render generically; text or markdown is a bonus rendering. */
export interface Report {
  type: ReportType | string;
  title?: string;
  generated_at?: string;
  node_id?: string | null;
  summary?: string;
  sections?: ReportSection[];
  /** A plain-text rendering when the backend provides one. */
  text?: string;
  /** A markdown rendering when the backend provides one. */
  markdown?: string;
  /** Anything the backend adds beyond the known fields stays reachable here. */
  [key: string]: unknown;
}

/** Generate a report of the given type, optionally scoped to one Node. */
export function getReport(
  type: ReportType,
  nodeId?: string,
  signal?: AbortSignal,
): Promise<Report> {
  return apiRequest<{ report?: Report } & Partial<Report>>('/reports', {
    query: { type, node_id: nodeId },
    signal,
  }).then((r) => r.report ?? (r as Report));
}
