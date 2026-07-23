/** A normalized API error. Every failed request surfaces one of these. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

interface BackendErrorShape {
  code?: unknown;
  message?: unknown;
  details?: unknown;
}

/**
 * Turn any thrown value or error body into a predictable ApiError. The backend
 * contract nests failures under an `error` envelope, `{"error":{"code","message"}}`,
 * so we unwrap that when present and fall back to a top-level shape otherwise.
 */
export function normalizeError(status: number, body: unknown): ApiError {
  if (body && typeof body === 'object') {
    const outer = body as { error?: unknown } & BackendErrorShape;
    const shape = (
      outer.error && typeof outer.error === 'object' ? outer.error : outer
    ) as BackendErrorShape;
    const code = typeof shape.code === 'string' ? shape.code : 'unknown_error';
    const message =
      typeof shape.message === 'string' ? shape.message : 'The request could not be completed.';
    return new ApiError(status, code, message, shape.details);
  }
  return new ApiError(status, 'unknown_error', 'The request could not be completed.');
}
