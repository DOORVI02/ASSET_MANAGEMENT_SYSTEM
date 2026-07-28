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

/** Maps a Cloudinary asset `format` (e.g. `"jpg"`, `"png"`, `"avif"`) back to the MIME type `attachments.file_type` stores. */
const FORMAT_TO_MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  avif: 'image/avif',
};

export function formatToMimeType(format: string): string | undefined {
  return FORMAT_TO_MIME[format.toLowerCase()];
}

export interface CloudinaryResource {
  publicId: string;
  format: string;
  bytes: number;
  secureUrl: string;
}

/**
 * Looks up a resource by public_id via the Admin API — the *authoritative* source for
 * what actually landed in Cloudinary. `cloudinary-finalize` uses this instead of
 * trusting whatever `format`/`bytes`/`secure_url` a client claims, since a client could
 * otherwise report an oversized or disallowed-format file as if it were compliant.
 * Returns `undefined` if Cloudinary has no such resource (a 404, not a thrown error —
 * "does this asset exist" is an expected, checked outcome here, not a failure mode).
 */
export async function lookupResource(
  config: CloudinaryConfig,
  publicId: string,
): Promise<CloudinaryResource | undefined> {
  const url = `https://api.cloudinary.com/v1_1/${config.cloudName}/resources/image/upload/${encodeURIComponent(publicId)}`;
  const response = await fetch(url, {
    headers: { Authorization: `Basic ${btoa(`${config.apiKey}:${config.apiSecret}`)}` },
  });
  if (response.status === 404) return undefined;
  if (!response.ok) {
    throw new Error(`Cloudinary resource lookup failed with status ${response.status}.`);
  }
  const data = await response.json();
  return {
    publicId: data.public_id,
    format: data.format,
    bytes: data.bytes,
    secureUrl: data.secure_url,
  };
}

/** Deletes a Cloudinary asset by public_id via the signed Admin API `destroy` call. */
export async function destroyResource(config: CloudinaryConfig, publicId: string): Promise<void> {
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = await signParams({ public_id: publicId, timestamp }, config.apiSecret);

  const form = new FormData();
  form.append('public_id', publicId);
  form.append('api_key', config.apiKey);
  form.append('timestamp', String(timestamp));
  form.append('signature', signature);

  const response = await fetch(`https://api.cloudinary.com/v1_1/${config.cloudName}/image/destroy`, {
    method: 'POST',
    body: form,
  });
  if (!response.ok) {
    throw new Error(`Cloudinary destroy failed with status ${response.status}.`);
  }
  const result = await response.json();
  // Cloudinary returns 200 with `{ result: "not found" }` for an already-gone asset —
  // treated as success (idempotent delete), not an error, since the end state (the
  // asset does not exist) is exactly what was wanted either way.
  if (result.result !== 'ok' && result.result !== 'not found') {
    throw new Error(`Cloudinary destroy returned unexpected result: ${result.result}`);
  }
}
