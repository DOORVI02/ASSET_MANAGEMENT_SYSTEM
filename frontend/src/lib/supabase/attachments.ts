/**
 * Real Cloudinary upload flow, calling the Phase 12 Edge Functions
 * (`cloudinary-sign`/`cloudinary-finalize`/`cloudinary-delete`) — the frontend
 * counterpart to `supabase/scripts/verify-cloudinary-lifecycle.mjs`, which exercises
 * the exact same three-step sequence from Node instead of a browser.
 *
 * Not imported by any page yet — like the rest of `src/lib/supabase/*`, this needs a
 * real signed-in Supabase session, and the app still runs entirely on `mock-auth.ts`
 * (Phase 11's "build the data layer now, wire pages in later" decision extends to
 * Phase 12's upload flow the same way). `getAuthorizedCaller` in the Edge Functions
 * will reject any call made without one.
 */
import { getSupabaseClient } from '@/lib/supabase';
import { mapAttachmentRow } from './mappers';
import type { Attachment } from '@/lib/types';

export type AttachableEntityType = 'machine' | 'part' | 'maintenance' | 'repair';

export interface SignedUpload {
  cloudName: string;
  apiKey: string;
  timestamp: number;
  signature: string;
  folder: string;
  publicId: string;
  overwrite: boolean;
  uploadUrl: string;
}

export interface CloudinaryUploadResult {
  publicId: string;
  secureUrl: string;
}

/** Asks `cloudinary-sign` to validate this request and sign the upload — see that function's own header comment for exactly what it checks. */
export async function signCloudinaryUpload(params: {
  entityType: AttachableEntityType;
  entityId: string;
  fileName: string;
  fileType: string;
  fileSize: number;
}): Promise<SignedUpload> {
  const client = getSupabaseClient();
  const { data, error } = await client.functions.invoke('cloudinary-sign', { body: params });
  if (error) throw error;
  return data as SignedUpload;
}

/**
 * Uploads the file directly to Cloudinary with the signed params from
 * `signCloudinaryUpload` — the API secret was only ever used server-side to produce
 * `signed.signature`; this request never carries it. Uses `XMLHttpRequest` rather than
 * `fetch` specifically for `upload.onprogress`, which `fetch` has no equivalent for.
 */
export function uploadToCloudinary(
  signed: SignedUpload,
  file: File,
  onProgress?: (percent: number) => void,
): Promise<CloudinaryUploadResult> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append('file', file);
    form.append('api_key', signed.apiKey);
    form.append('timestamp', String(signed.timestamp));
    form.append('signature', signed.signature);
    form.append('folder', signed.folder);
    form.append('public_id', signed.publicId);
    if (signed.overwrite) form.append('overwrite', 'true');

    const xhr = new XMLHttpRequest();
    xhr.open('POST', signed.uploadUrl);
    xhr.upload.onprogress = (event) => {
      if (onProgress && event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const response = JSON.parse(xhr.responseText);
          resolve({ publicId: response.public_id, secureUrl: response.secure_url });
        } catch {
          reject(new Error('Cloudinary returned an unreadable response.'));
        }
      } else {
        reject(new Error(`Cloudinary upload failed with status ${xhr.status}.`));
      }
    };
    xhr.onerror = () => reject(new Error('Cloudinary upload failed due to a network error.'));
    xhr.send(form);
  });
}

/** Asks `cloudinary-finalize` to verify the upload against Cloudinary's own record of it and write the `attachments` row. */
export async function finalizeCloudinaryUpload(params: {
  entityType: AttachableEntityType;
  entityId: string;
  publicId: string;
  fileName: string;
}): Promise<Attachment> {
  const client = getSupabaseClient();
  const { data, error } = await client.functions.invoke('cloudinary-finalize', { body: params });
  if (error) throw error;
  return mapAttachmentRow(data);
}

/** Asks `cloudinary-delete` to remove both the Cloudinary asset and the `attachments` row. */
export async function deleteCloudinaryAttachment(attachmentId: string): Promise<void> {
  const client = getSupabaseClient();
  const { error } = await client.functions.invoke('cloudinary-delete', { body: { attachmentId } });
  if (error) throw error;
}

/**
 * The full sign → upload → finalize sequence in one call — what a page actually
 * wants to invoke. Kept as three separable functions above (rather than folded
 * entirely into this one) so a test, or a future retry-after-upload-but-before-
 * finalize path, can drive each step independently.
 */
export async function uploadAndFinalizeImage(params: {
  entityType: AttachableEntityType;
  entityId: string;
  file: File;
  onProgress?: (percent: number) => void;
}): Promise<Attachment> {
  const signed = await signCloudinaryUpload({
    entityType: params.entityType,
    entityId: params.entityId,
    fileName: params.file.name,
    fileType: params.file.type,
    fileSize: params.file.size,
  });
  const uploaded = await uploadToCloudinary(signed, params.file, params.onProgress);
  return finalizeCloudinaryUpload({
    entityType: params.entityType,
    entityId: params.entityId,
    publicId: uploaded.publicId,
    fileName: params.file.name,
  });
}
