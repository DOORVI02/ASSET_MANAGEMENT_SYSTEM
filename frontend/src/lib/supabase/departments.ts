/**
 * Department reads. Departments have no RLS-scoped mutation surface from the app yet
 * (`profiles`/`profile_department_scope` govern who sees what, not `departments`
 * itself), so this module is read-only, mirroring `listDepartmentsInScope` and
 * `getDepartmentSummary` from the mock repository.
 */
import { getSupabaseClient } from '@/lib/supabase';
import { mapDepartmentRow } from './mappers';
import type { AccessScope, Department, DepartmentSummary } from '@/lib/types';

export async function listDepartmentsInScope(scope: AccessScope): Promise<Department[]> {
  if (scope.departmentIds.length === 0) return [];
  const client = getSupabaseClient();

  const [{ data: departments, error: departmentsError }, { data: machines, error: machinesError }] =
    await Promise.all([
      client
        .from('departments')
        .select('*')
        .in('id', scope.departmentIds)
        .order('sort_order', { ascending: true }),
      client.from('machines').select('id, department_id').in('department_id', scope.departmentIds),
    ]);

  if (departmentsError) throw departmentsError;
  if (machinesError) throw machinesError;

  const countByDepartment = new Map<string, number>();
  for (const machine of machines ?? []) {
    countByDepartment.set(
      machine.department_id,
      (countByDepartment.get(machine.department_id) ?? 0) + 1,
    );
  }

  return (departments ?? []).map((row) =>
    mapDepartmentRow(row, countByDepartment.get(row.id) ?? 0),
  );
}

export async function getDepartmentSummary(
  departmentId: string,
  scope: AccessScope,
): Promise<DepartmentSummary> {
  const empty: DepartmentSummary = {
    departmentId,
    total: 0,
    active: 0,
    inactive: 0,
    underMaintenance: 0,
    underRepair: 0,
    retired: 0,
    dueSoon: 0,
    overdue: 0,
  };
  if (!scope.departmentIds.includes(departmentId)) return empty;

  const client = getSupabaseClient();
  const { data, error } = await client
    .from('department_summary')
    .select('*')
    .eq('department_id', departmentId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return empty;

  // The real generated types show every column here as nullable — Postgres's view
  // introspection can't express that these aggregates are always COALESCE(..., 0) in
  // the view's own SQL (`20260727000009_derived_status_and_views.sql`), never actually
  // null. `department_id` falls back to the function's own `departmentId` param
  // (always the same value `data.department_id` would hold) rather than a magic 0.
  return {
    departmentId: data.department_id ?? departmentId,
    total: data.total ?? 0,
    active: data.active ?? 0,
    inactive: data.inactive ?? 0,
    underMaintenance: data.under_maintenance ?? 0,
    underRepair: data.under_repair ?? 0,
    retired: data.retired ?? 0,
    dueSoon: data.due_soon ?? 0,
    overdue: data.overdue ?? 0,
  };
}
