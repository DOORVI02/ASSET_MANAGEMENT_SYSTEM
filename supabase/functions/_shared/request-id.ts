/** One correlation ID per invocation, echoed in every response and log line. */
export function requestId(): string {
  return crypto.randomUUID();
}
