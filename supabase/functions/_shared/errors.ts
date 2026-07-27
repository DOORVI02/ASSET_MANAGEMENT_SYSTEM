/**
 * Uniform error envelope so every Edge Function fails the same way, with a request ID
 * attached for support/log correlation. Untested against a running function — see the
 * note in `cors.ts`.
 */
import { corsHeaders } from './cors.ts';

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export function errorResponse(error: unknown, requestId: string, origin: string | null): Response {
  const status = error instanceof HttpError ? error.status : 500;
  // Unexpected (non-HttpError) failures get a generic message in the response — the
  // real detail goes to the platform log, keyed by requestId, not to the caller.
  const message =
    error instanceof HttpError
      ? error.message
      : 'Unexpected error. Include the request ID if you report this.';

  if (!(error instanceof HttpError)) {
    console.error(`[${requestId}]`, error);
  }

  return new Response(JSON.stringify({ error: message, requestId }), {
    status,
    headers: { ...corsHeaders(origin), 'Content-Type': 'application/json', 'X-Request-Id': requestId },
  });
}

export function jsonResponse(body: unknown, requestId: string, origin: string | null): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...corsHeaders(origin), 'Content-Type': 'application/json', 'X-Request-Id': requestId },
  });
}
