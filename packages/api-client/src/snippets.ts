import { apiRequest } from './http';

/*
 * The command snippet library: a name and a command an Operator has saved so
 * it can be picked from any open terminal instead of retyped. A snippet has
 * no relationship to any Node or Service -- a terminal can be opened against
 * either, and the same command is just as reusable from both.
 */

/** One saved command. */
export interface Snippet {
  id: string;
  name: string;
  command: string;
  created_at: string;
  updated_at: string;
}

export interface SaveSnippetInput {
  name: string;
  command: string;
}

/** List every snippet in the Operator's library. */
export function listSnippets(signal?: AbortSignal): Promise<Snippet[]> {
  return apiRequest<{ snippets: Snippet[] }>('/snippets', { signal }).then((r) => r.snippets);
}

/** Save a new command under a name. */
export function createSnippet(input: SaveSnippetInput): Promise<Snippet> {
  return apiRequest<{ snippet: Snippet }>('/snippets', { method: 'POST', body: input }).then(
    (r) => r.snippet,
  );
}

/** Change a saved snippet's name and command. */
export function updateSnippet(id: string, input: SaveSnippetInput): Promise<Snippet> {
  return apiRequest<{ snippet: Snippet }>(`/snippets/${id}`, { method: 'PATCH', body: input }).then(
    (r) => r.snippet,
  );
}

/** Remove a snippet from the library. */
export function deleteSnippet(id: string): Promise<void> {
  return apiRequest<void>(`/snippets/${id}`, { method: 'DELETE' });
}
