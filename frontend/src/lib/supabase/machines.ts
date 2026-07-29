import { getSupabaseClient } from '@/lib/supabase';
import { mapAttachmentRow, mapMachineRow } from './mappers';
import {
  clampPageSize,
  fetchAllPages,
  toRange,
  withTieBreaker,
  type OrderSpec,
  type PagedResult,
} from './pagination';
import type {
  AccessScope,
  Attachment,
  AttachmentInput,
  Machine,
  MachineInput,
  MachineStatus,
  MachineType,
  MutationResult,
} from '@/lib/types';

export interface MachineListFilters {
  search?: string;
  departmentId?: string;
  status?: MachineStatus;
  type?: MachineType;
}

export interface MachineListParams {
  scope: AccessScope;
  filters?: MachineListFilters;
  order?: OrderSpec;
  page?: number;
  pageSize?: number;
}

/** Mirrors `listMachinesForDepartment`/`listMachinesInScope`, but paginated server-side. */
export async function listMachinesInScope(
  params: MachineListParams,
): Promise<PagedResult<Machine>> {
  if (params.scope.departmentIds.length === 0) return { rows: [], total: 0 };

  const client = getSupabaseClient();
  const pageSize = clampPageSize(params.pageSize);
  const { from, to } = toRange(params.page ?? 1, pageSize);
  const order = withTieBreaker(params.order ?? { column: 'code', ascending: true });
  const filters = params.filters;

  let query = client
    .from('machines_with_derived')
    .select('*', { count: 'exact' })
    .in('department_id', params.scope.departmentIds);
  if (!params.scope.includeArchived) query = query.eq('is_archived', false);
  if (filters?.departmentId) query = query.eq('department_id', filters.departmentId);
  if (filters?.status) query = query.eq('status', filters.status);
  if (filters?.type) query = query.eq('type', filters.type);
  if (filters?.search) {
    const term = filters.search.trim();
    if (term) query = query.or(`name.ilike.%${term}%,code.ilike.%${term}%`);
  }
  for (const spec of order) {
    query = query.order(spec.column, { ascending: spec.ascending ?? true });
  }
  query = query.range(from, to);

  const { data, error, count } = await query;
  if (error) throw error;

  return { rows: (data ?? []).map(mapMachineRow), total: count ?? 0 };
}

/**
 * Every machine in scope, as one array.
 *
 * The register screen filters, sorts and paginates in the browser over a complete list —
 * multi-select statuses, a derived overdue/due-soon filter, and a multi-department filter,
 * none of which `MachineListFilters`' single-value params express. See `fetchAllPages` for
 * why this walks pages rather than requesting one large one.
 */
export async function listAllMachinesInScope(scope: AccessScope): Promise<Machine[]> {
  if (scope.departmentIds.length === 0) return [];
  return fetchAllPages((page, pageSize) =>
    listMachinesInScope({ scope, page, pageSize }),
  );
}

export async function getMachineInScope(
  machineId: string,
  scope: AccessScope,
): Promise<Machine | undefined> {
  if (scope.departmentIds.length === 0) return undefined;
  const client = getSupabaseClient();
  let query = client
    .from('machines_with_derived')
    .select('*')
    .eq('id', machineId)
    .in('department_id', scope.departmentIds);
  if (!scope.includeArchived) query = query.eq('is_archived', false);

  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data ? mapMachineRow(data) : undefined;
}

export async function isMachineCodeTaken(
  code: string,
  excludeMachineId?: string,
): Promise<boolean> {
  const client = getSupabaseClient();
  let query = client
    .from('machines')
    .select('id', { count: 'exact', head: true })
    .ilike('code', code.trim());
  if (excludeMachineId) query = query.neq('id', excludeMachineId);
  const { count, error } = await query;
  if (error) throw error;
  return (count ?? 0) > 0;
}

function toMachineInsert(input: MachineInput) {
  return {
    code: input.code.trim(),
    name: input.name.trim(),
    department_id: input.departmentId,
    type: input.type,
    manufacturer: input.manufacturer.trim(),
    model: input.model.trim(),
    location: input.location.trim(),
    status: input.status,
    installation_date: input.installationDate,
    next_maintenance_date: input.nextMaintenanceDate,
    description: input.description.trim(),
    serial_number: input.serialNumber?.trim() || null,
    capacity: input.capacity?.trim() || null,
    power_rating: input.powerRating?.trim() || null,
    voltage: input.voltage?.trim() || null,
    weight: input.weight?.trim() || null,
    plant_area: input.plantArea?.trim() || null,
    bay_section: input.baySection?.trim() || null,
    floor: input.floor?.trim() || null,
    room_position: input.roomPosition?.trim() || null,
  };
}

/**
 * Uses PostgREST's own unique-violation error (23505 on `machines_code_key`) as the
 * duplicate-code check, rather than a separate `isMachineCodeTaken` round trip first —
 * eliminates the check-then-act race the mock repository's in-memory version can't
 * have, but a real concurrent DB can.
 */
export async function createMachine(input: MachineInput): Promise<MutationResult<Machine>> {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from('machines')
    .insert(toMachineInsert(input))
    .select('*')
    .single();

  if (error) {
    if (error.code === '23505') {
      return {
        ok: false,
        reason: 'duplicate_code',
        message: `Machine code ${input.code} is already used by another machine.`,
      };
    }
    if (error.code === '23503') {
      return {
        ok: false,
        reason: 'unknown_department',
        message: 'Select a department from the list.',
      };
    }
    throw error;
  }

  const created = await getMachineInScope(data.id, {
    departmentIds: [data.department_id],
    includeArchived: true,
  });
  if (!created) throw new Error('Machine was created but could not be re-read.');
  return { ok: true, data: created };
}

export async function updateMachine(
  machineId: string,
  input: MachineInput,
): Promise<MutationResult<Machine>> {
  const client = getSupabaseClient();
  const { error } = await client
    .from('machines')
    .update(toMachineInsert(input))
    .eq('id', machineId)
    .eq('is_archived', false);

  if (error) {
    if (error.code === '23505') {
      return {
        ok: false,
        reason: 'duplicate_code',
        message: `Machine code ${input.code} is already used by another machine.`,
      };
    }
    if (error.code === '23503') {
      return {
        ok: false,
        reason: 'unknown_department',
        message: 'Select a department from the list.',
      };
    }
    throw error;
  }

  const updated = await getMachineInScope(machineId, {
    departmentIds: [input.departmentId],
    includeArchived: true,
  });
  if (!updated)
    return {
      ok: false,
      reason: 'not_found',
      message: 'This machine no longer exists in the register.',
    };
  return { ok: true, data: updated };
}

async function setArchived(machineId: string, isArchived: boolean, status: MachineStatus) {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from('machines')
    .update({ is_archived: isArchived, status })
    .eq('id', machineId)
    .eq('is_archived', !isArchived)
    .select('department_id')
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function archiveMachine(machineId: string): Promise<MutationResult<Machine>> {
  const row = await setArchived(machineId, true, 'retired');
  if (!row)
    return { ok: false, reason: 'already_archived', message: 'This machine is already archived.' };
  const machine = await getMachineInScope(machineId, {
    departmentIds: [row.department_id],
    includeArchived: true,
  });
  if (!machine) throw new Error('Machine was archived but could not be re-read.');
  return { ok: true, data: machine };
}

export async function restoreMachine(machineId: string): Promise<MutationResult<Machine>> {
  const row = await setArchived(machineId, false, 'inactive');
  if (!row) return { ok: false, reason: 'not_archived', message: 'This machine is not archived.' };
  const machine = await getMachineInScope(machineId, {
    departmentIds: [row.department_id],
    includeArchived: true,
  });
  if (!machine) throw new Error('Machine was restored but could not be re-read.');
  return { ok: true, data: machine };
}

export async function getMachineImage(machineId: string): Promise<Attachment | undefined> {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from('attachments')
    .select('*')
    .eq('entity_type', 'machine')
    .eq('entity_id', machineId)
    .maybeSingle();
  if (error) throw error;
  return data ? mapAttachmentRow(data) : undefined;
}

/** One image per machine: a new upload replaces the previous one, mirroring the mock repository. */
export async function setMachineImage(
  machineId: string,
  input: AttachmentInput,
  uploadedBy: string,
): Promise<MutationResult<Attachment>> {
  const client = getSupabaseClient();
  const { data: existing, error: findError } = await client
    .from('attachments')
    .select('id')
    .eq('entity_type', 'machine')
    .eq('entity_id', machineId)
    .maybeSingle();
  if (findError) throw findError;

  if (existing) {
    const { error: deleteError } = await client.from('attachments').delete().eq('id', existing.id);
    if (deleteError) throw deleteError;
  }

  const { data, error } = await client
    .from('attachments')
    .insert({
      entity_id: machineId,
      entity_type: 'machine',
      file_name: input.fileName,
      file_type: input.fileType,
      file_size: input.fileSize,
      uploaded_by: uploadedBy,
      url: input.url,
    })
    .select('*')
    .single();
  if (error) throw error;
  return { ok: true, data: mapAttachmentRow(data) };
}

export async function removeMachineImage(machineId: string): Promise<MutationResult<Attachment>> {
  const client = getSupabaseClient();
  const { data: existing, error: findError } = await client
    .from('attachments')
    .select('*')
    .eq('entity_type', 'machine')
    .eq('entity_id', machineId)
    .maybeSingle();
  if (findError) throw findError;
  if (!existing)
    return { ok: false, reason: 'not_found', message: 'This machine has no image to remove.' };

  const { error } = await client.from('attachments').delete().eq('id', existing.id);
  if (error) throw error;
  return { ok: true, data: mapAttachmentRow(existing) };
}
