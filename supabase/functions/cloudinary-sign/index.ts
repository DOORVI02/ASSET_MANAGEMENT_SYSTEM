/**
 * Signs a Cloudinary upload for one attachment. The browser calls this first, then
 * uploads the file bytes directly to Cloudinary with the returned params — the API
 * secret never leaves this function.
 *
 * Request: { entityType: 'machine'|'part'|'maintenance'|'repair', entityId: uuid,
 *            fileName: string, fileType: string, fileSize: number }
 * Response: { cloudName, apiKey, timestamp, signature, folder, publicId, overwrite, uploadUrl }
 *
 * Validates, in order: bearer JWT and active profile (`_shared/auth.ts`), role
 * (Officer or Supervisor — `.agents/plan.md` "Image edit authority"), file type/size
 * against the same limits `attachments`'s CHECK constraints enforce, and that the
 * parent entity exists, is not archived, and is in the caller's department scope —
 * the same check `entity_department_id()` backs for the `attachments` RLS policies,
 * run here via the service-role client since this function executes before any
 * `attachments` row exists for RLS to protect.
 */
import { z } from 'npm:zod@3';
import { getAuthorizedCaller, serviceRoleClient } from '../_shared/auth.ts';
import { handlePreflight } from '../_shared/cors.ts';
import { errorResponse, jsonResponse, HttpError } from '../_shared/errors.ts';
import { requestId } from '../_shared/request-id.ts';
import { parseJsonBody } from '../_shared/validation.ts';
import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES, loadCloudinaryConfig, signParams } from '../_shared/cloudinary.ts';
import { ATTACHABLE_ENTITY_TYPES, SINGLE_IMAGE_ENTITY_TYPES, resolveEntityDepartment } from '../_shared/entities.ts';

const requestSchema = z.object({
  entityType: z.enum(ATTACHABLE_ENTITY_TYPES),
  entityId: z.string().uuid(),
  fileName: z.string().min(1).max(255),
  fileType: z.enum(ALLOWED_IMAGE_TYPES),
  fileSize: z
    .number()
    .int()
    .positive()
    .max(MAX_IMAGE_BYTES, `File exceeds the ${MAX_IMAGE_BYTES / (1024 * 1024)} MB limit.`),
});

Deno.serve(async (req) => {
  const id = requestId();
  const origin = req.headers.get('origin');
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  try {
    if (req.method !== 'POST') throw new HttpError(405, 'Use POST.');

    const caller = await getAuthorizedCaller(req);
    if (caller.role !== 'officer' && caller.role !== 'supervisor') {
      throw new HttpError(403, 'Only Officers and Supervisors may upload images.');
    }

    const body = await parseJsonBody(req, requestSchema);

    const client = serviceRoleClient();
    const departmentId = await resolveEntityDepartment(client, body.entityType, body.entityId);
    if (!caller.departmentIds.includes(departmentId)) {
      throw new HttpError(403, 'This entity is outside your department scope.');
    }

    const { cloudName, apiKey, apiSecret } = loadCloudinaryConfig();
    const timestamp = Math.floor(Date.now() / 1000);
    const folder = `sail-plant-maintenance/${body.entityType}`;
    const isSingleImage = SINGLE_IMAGE_ENTITY_TYPES.has(body.entityType);
    // Single-image entities (machine/part): a fixed public_id per entity with
    // `overwrite=true` means re-uploading always replaces the same Cloudinary asset in
    // place — the asset slot never grows unbounded even if `cloudinary-finalize`'s
    // corresponding old-row cleanup is ever skipped. Multi-image entities (repair,
    // and maintenance by the same default): a unique public_id per upload, since a
    // fixed one would silently overwrite a prior evidence shot instead of adding to it.
    const publicId = isSingleImage ? body.entityId : `${body.entityId}/${crypto.randomUUID()}`;

    const paramsToSign: Record<string, string | number> = {
      timestamp,
      folder,
      public_id: publicId,
    };
    if (isSingleImage) paramsToSign.overwrite = 'true';
    const signature = await signParams(paramsToSign, apiSecret);

    return jsonResponse(
      {
        cloudName,
        apiKey,
        timestamp,
        signature,
        folder,
        publicId,
        overwrite: isSingleImage,
        uploadUrl: `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
      },
      id,
      origin,
    );
  } catch (error) {
    return errorResponse(error, id, origin);
  }
});
