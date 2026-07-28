/**
 * Cloudinary signed-upload helpers. The API secret is read once here from the Edge
 * Function's own environment (`supabase secrets set CLOUDINARY_API_SECRET=...`) and
 * never returned to a caller — only the resulting signature is.
 *
 * Signing algorithm, per Cloudinary's docs: take every parameter that will be sent to
 * the upload API *except* `file`, `cloud_name`, `resource_type`, and the api key/
 * secret themselves; sort by parameter name; join as `key=value` pairs with `&`;
 * append the API secret directly (no separator); SHA-1 hash the result; hex-encode.
 */

/** Mirrors `attachments_file_type_accepted`/`attachments_file_size_within_limit` (`supabase/migrations/20260727000011_...sql`) — kept in sync by hand since Edge Functions can't import from the frontend's `image-policy.ts`. */
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/avif'] as const;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export interface CloudinaryConfig {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
}

export function loadCloudinaryConfig(): CloudinaryConfig {
  const cloudName = Deno.env.get('CLOUDINARY_CLOUD_NAME');
  const apiKey = Deno.env.get('CLOUDINARY_API_KEY');
  const apiSecret = Deno.env.get('CLOUDINARY_API_SECRET');
  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error('Edge Function is missing its Cloudinary configuration.');
  }
  return { cloudName, apiKey, apiSecret };
}

async function sha1Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-1', bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Signs a set of upload parameters. `params` must be exactly what the client will also
 * send to Cloudinary alongside `file`/`api_key` — any mismatch (an extra or missing
 * key, a different value) makes Cloudinary reject the upload with a signature
 * mismatch, since it recomputes the same hash server-side over what it actually received.
 */
export async function signParams(
  params: Record<string, string | number>,
  apiSecret: string,
): Promise<string> {
  const toSign = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('&');
  return sha1Hex(`${toSign}${apiSecret}`);
}
