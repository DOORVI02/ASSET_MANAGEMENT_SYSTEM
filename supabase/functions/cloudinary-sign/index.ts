/**
 * Signs a Cloudinary upload for one attachment. The browser calls this first, then
 * uploads the file bytes directly to Cloudinary with the returned params — the API
 * secret never leaves this function.
 *
 * Request: { entityType: 'machine'|'part'|'maintenance'|'repair', entityId: uuid,
 *            fileName: string, fileType: string, fileSize: number }
 * Response: { cloudName, apiKey, timestamp, signature, folder, publicId, uploadUrl }
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
import { corsHeaders, handlePreflight } from '../_shared/cors.ts';
import { errorResponse, jsonResponse, HttpError } from '../_shared/errors.ts';
import { requestId } from '../_shared/request-id.ts';
import { parseJsonBody } from '../_shared/validation.ts';
import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES, loadCloudinaryConfig, signParams } from '../_shared/cloudinary.ts';

const requestSchema = z.object({
  entityType: z.enum(['machine', 'part', 'maintenance', 'repair']),
  entityId: z.string().uuid(),
  fileName: z.string().min(1).max(255),
  fileType: z.enum(ALLOWED_IMAGE_TYPES),
  fileSize: z
    .number()
    .int()
    .positive()
    .max(MAX_IMAGE_BYTES, `File exceeds the ${MAX_IMAGE_BYTES / (1024 * 1024)} MB limit.`),
});

const entityTables: Record<z.infer<typeof requestSchema>['entityType'], string> = {
  machine: 'machines',
  part: 'machine_parts',
  maintenance: 'maintenance_records',
  repair: 'repair_records',
};

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
    // One image per entity: a fixed public_id per (entityType, entityId), with
    // `overwrite=true`, means re-uploading always replaces the same Cloudinary asset
    // rather than accumulating orphans — `cloudinary-cleanup` still removes the old
    // `attachments` row/asset pointer, but the asset slot itself never grows unbounded
    // even if that step is ever skipped.
    const folder = `sail-plant-maintenance/${body.entityType}`;
    const publicId = body.entityId;

    const paramsToSign = {
      timestamp,
      folder,
      public_id: publicId,
      overwrite: 'true',
    };
    const signature = await signParams(paramsToSign, apiSecret);

    return jsonResponse(
      {
        cloudName,
        apiKey,
        timestamp,
        signature,
        folder,
        publicId,
        uploadUrl: `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
      },
      id,
      origin,
    );
  } catch (error) {
    return errorResponse(error, id, origin);
  }
});

/** Returns the entity's `department_id`, resolved generically across all four attachable entity types. */
async function resolveEntityDepartment(
  client: ReturnType<typeof serviceRoleClient>,
  entityType: z.infer<typeof requestSchema>['entityType'],
  entityId: string,
): Promise<string> {
  if (entityType === 'machine') {
    const { data, error } = await client
      .from('machines')
      .select('department_id, is_archived')
      .eq('id', entityId)
      .maybeSingle();
    if (error) throw new HttpError(500, 'Failed to look up the machine.');
    if (!data) throw new HttpError(404, 'Machine not found.');
    if (data.is_archived) throw new HttpError(409, 'Archived machines do not accept image changes.');
    return data.department_id;
  }

  const joinTable = entityTables[entityType];
  const { data, error } = await client
    .from(joinTable)
    .select('machine_id, machines:machine_id(department_id, is_archived)')
    .eq('id', entityId)
    .maybeSingle();
  if (error) throw new HttpError(500, `Failed to look up the ${entityType} record.`);
  if (!data) throw new HttpError(404, `${entityType} record not found.`);
  const machine = data.machines as { department_id: string; is_archived: boolean } | null;
  if (!machine) throw new HttpError(404, 'Parent machine not found.');
  if (machine.is_archived) throw new HttpError(409, 'Archived machines do not accept image changes.');
  return machine.department_id;
}
