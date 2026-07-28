/**
 * Resolves an attachable entity's parent machine/department, generically across all
 * four `attachment_entity_type` values. Shared by every function that must check "is
 * this entity in the caller's department, and not archived" before touching its
 * attachments — `cloudinary-sign` and `cloudinary-finalize` today.
 */
import { serviceRoleClient } from './auth.ts';
import { HttpError } from './errors.ts';

export const ATTACHABLE_ENTITY_TYPES = ['machine', 'part', 'maintenance', 'repair'] as const;
export type AttachableEntityType = (typeof ATTACHABLE_ENTITY_TYPES)[number];

/**
 * Only `machine`/`part` are single-image, replace-on-upload entities — enforced at the
 * DB layer by `attachments_single_per_machine_or_part_idx`, a partial unique index on
 * `(entity_type, entity_id)`. `repair` is deliberately multi-image (before/during/after
 * evidence shots); `maintenance` has "no confirmed single-vs-multiple decision"
 * (migration comment) and is treated the same as `repair` here — unconstrained, so
 * multiple images is the safe default, not single-image-replace.
 */
export const SINGLE_IMAGE_ENTITY_TYPES: ReadonlySet<AttachableEntityType> = new Set(['machine', 'part']);

const entityTables: Record<AttachableEntityType, string> = {
  machine: 'machines',
  part: 'machine_parts',
  maintenance: 'maintenance_records',
  repair: 'repair_records',
};

/** Returns the entity's `department_id`, resolved generically across all four attachable entity types, and rejects if the parent machine is archived. */
export async function resolveEntityDepartment(
  client: ReturnType<typeof serviceRoleClient>,
  entityType: AttachableEntityType,
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
