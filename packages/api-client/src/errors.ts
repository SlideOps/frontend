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
 * What to say when the response carried no error envelope for us to read.
 *
 * A bare "The request could not be completed" is what this used to return for
 * every such case, and it hid the cause three separate times: a dev proxy pointing
 * at a dead port, a request body the server rejected outright, and an endpoint the
 * running server did not have. All three look identical to the person reading the
 * screen, and none of them is a problem with what they typed.
 *
 * The status code alone distinguishes them, so it is worth saying which happened.
 */
function unparseableMessage(status: number): string {
  // Status 0 is what the fetch layer reports when the request never got an HTTP
  // response at all: the server is down, or a dev proxy has nothing behind it.
  if (status === 0) {
    return 'The server could not be reached. Check it is running and that the API address is correct.';
  }
  if (status === 404) {
    return 'The server does not have this endpoint. It is most likely running an older build than this app — rebuild and restart the API.';
  }
  if (status === 502 || status === 503 || status === 504) {
    return 'The server is not answering right now. It may be restarting; try again in a moment.';
  }
  if (status >= 500) {
    return 'The server hit an unexpected problem. Its logs will say more.';
  }
  if (status === 401) {
    return 'Your session has expired. Sign in again.';
  }
  if (status >= 400) {
    return `The server rejected this request (HTTP ${status}) without saying why.`;
  }
  return 'The request could not be completed.';
}

/**
 * Turn any thrown value or error body into a predictable ApiError. The backend
 * contract nests failures under an `error` envelope, `{"error":{"code","message"}}`,
 * so we unwrap that when present and fall back to a top-level shape otherwise.
 *
 * When there is no envelope to read -- an unreachable server, a framework 404, a
 * proxy error page -- the message is derived from the status rather than being a
 * single generic sentence, because the generic one repeatedly sent people looking
 * for a fault in their own input that was never there.
 */
export function normalizeError(status: number, body: unknown): ApiError {
  if (body && typeof body === 'object') {
    const outer = body as { error?: unknown } & BackendErrorShape;
    const shape = (
      outer.error && typeof outer.error === 'object' ? outer.error : outer
    ) as BackendErrorShape;
    const code = typeof shape.code === 'string' ? shape.code : 'unknown_error';
    const message = typeof shape.message === 'string' ? shape.message : unparseableMessage(status);
    return new ApiError(status, code, message, shape.details);
  }
  return new ApiError(status, 'unknown_error', unparseableMessage(status));
}
