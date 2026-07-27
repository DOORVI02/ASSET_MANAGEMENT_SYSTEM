/** Parses and validates a JSON request body against a Zod schema, or throws `HttpError`. */
import { type ZodType } from 'npm:zod@3';
import { HttpError } from './errors.ts';

export async function parseJsonBody<T>(req: Request, schema: ZodType<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new HttpError(400, 'Request body must be valid JSON.');
  }

  const result = schema.safeParse(raw);
  if (!result.success) {
    throw new HttpError(400, `Invalid request body: ${result.error.issues[0]?.message}`);
  }
  return result.data;
}
