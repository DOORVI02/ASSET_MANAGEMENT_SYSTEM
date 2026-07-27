/**
 * Pure DB-row → frozen-frontend-contract mappers. Every function here takes exactly
 * what a query in `src/lib/supabase/*.ts` selects and returns exactly the shape
 * `src/lib/types.ts` already defines — the whole point of Phase 11 is that pages never
 * need to know whether their data came from the mock repository or from Supabase.
 *
 * Actor fields (`performedBy`, `uploadedBy`) are passed through as the raw profile
 * UUID, not resolved to a display name here — that matches the existing mock contract
 * exactly (`PartDetailPage.tsx`'s local `actorName()` helper already does this lookup
 * against a fetched user list, the same pattern `listProfileNames` in `profiles.ts`
 * supports here).
 */
import type {
  Attachment,
  Department,
  DueState,
  Machine,
  MachinePart,
  MaintenancePlan,
  MaintenanceRecord,
  PartReplacement,
  RepairRecord,
} from '@/lib/types';
import type { Database } from '@/lib/database.types';

type MachineRow = Database['public']['Tables']['machines']['Row'];
type MachineWithDerivedRow = Database['public']['Views']['machines_with_derived']['Row'];
type DepartmentRow = Database['public']['Tables']['departments']['Row'];
type MachinePartRow = Database['public']['Tables']['machine_parts']['Row'];
type PartReplacementRow = Database['public']['Tables']['part_replacements']['Row'];
type MaintenanceRecordRow = Database['public']['Tables']['maintenance_records']['Row'];
type MaintenancePlanRow = Database['public']['Tables']['maintenance_plans']['Row'];
type RepairRecordRow = Database['public']['Tables']['repair_records']['Row'];
type AttachmentRow = Database['public']['Tables']['attachments']['Row'];

/** A minimal machine reference, as embedded by a PostgREST foreign-table select. */
interface MachineRef {
  code: string;
  name: string;
}

export function mapDepartmentRow(row: DepartmentRow, machineCount = 0): Department {
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    head: row.head,
    machineCount,
  };
}

/**
 * Machines always come from `machines_with_derived`, never the bare `machines` table
 * directly — that view is what carries `department`/`lastMaintenanceDate`/`imageUrl`,
 * none of which are stored columns (see the migration's own comment on why).
 */
export function mapMachineRow(row: MachineWithDerivedRow): Machine {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    department: row.department_name,
    departmentId: row.department_id,
    type: row.type,
    manufacturer: row.manufacturer,
    model: row.model,
    location: row.location,
    status: row.status,
    installationDate: row.installation_date,
    lastMaintenanceDate: row.last_maintenance_date ?? '',
    nextMaintenanceDate: row.next_maintenance_date,
    description: row.description,
    imageUrl: row.image_url ?? undefined,
    isArchived: row.is_archived,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    serialNumber: row.serial_number ?? undefined,
    capacity: row.capacity ?? undefined,
    powerRating: row.power_rating ?? undefined,
    voltage: row.voltage ?? undefined,
    weight: row.weight ?? undefined,
    plantArea: row.plant_area ?? undefined,
    baySection: row.bay_section ?? undefined,
    floor: row.floor ?? undefined,
    roomPosition: row.room_position ?? undefined,
  };
}

/** Used only where a caller already has a plain `machines` row and no derived view join. */
export function mapMachineRowWithoutDerived(row: MachineRow, departmentName: string): Machine {
  return mapMachineRow({
    ...row,
    department_name: departmentName,
    department_code: '',
    last_maintenance_date: null,
    due_state: 'not_applicable',
    image_url: null,
  });
}

export function mapMachinePartRow(row: MachinePartRow & { machine: MachineRef }): MachinePart {
  return {
    id: row.id,
    machineId: row.machine_id,
    machineName: row.machine.name,
    machineCode: row.machine.code,
    partCode: row.part_code,
    partName: row.part_name,
    category: row.category,
    serialNumber: row.serial_number ?? undefined,
    quantity: Number(row.quantity),
    unit: row.unit,
    positionOnMachine: row.position_on_machine,
    fittedDate: row.fitted_date,
    expectedLifeMonths: row.expected_life_months ?? undefined,
    notes: row.notes,
    isArchived: row.is_archived,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapPartReplacementRow(row: PartReplacementRow): PartReplacement {
  return {
    id: row.id,
    partId: row.part_id,
    // `machineId` is on the frontend type for display convenience but is not a real
    // column here (see the migration comment: it is fully derivable via `part_id`,
    // which never changes machines) — callers join it in from the parent part.
    machineId: '',
    replacedOn: row.replaced_on,
    reason: row.reason,
    previousSerialNumber: row.previous_serial_number ?? undefined,
    newSerialNumber: row.new_serial_number ?? undefined,
    performedBy: row.performed_by,
    notes: row.notes ?? undefined,
  };
}

export function mapMaintenanceRecordRow(
  row: MaintenanceRecordRow & { machine: MachineRef; technician: { name: string } },
): MaintenanceRecord {
  return {
    id: row.id,
    machineId: row.machine_id,
    machineName: row.machine.name,
    machineCode: row.machine.code,
    planId: row.plan_id ?? undefined,
    type: row.type,
    status: row.status,
    scheduledDate: row.scheduled_date,
    completedDate: row.completed_date ?? undefined,
    technicianId: row.technician_id,
    technicianName: row.technician.name,
    description: row.description,
    findings: row.findings ?? undefined,
    actions: row.actions ?? undefined,
    partsUsed: row.parts_used ?? undefined,
    durationHours: row.duration_hours === null ? undefined : Number(row.duration_hours),
    remarks: row.remarks ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapMaintenancePlanRow(
  row: MaintenancePlanRow & { machine: MachineRef; technician: { name: string } | null },
): MaintenancePlan {
  return {
    id: row.id,
    machineId: row.machine_id,
    machineName: row.machine.name,
    machineCode: row.machine.code,
    type: row.type,
    description: row.description,
    intervalValue: row.interval_value,
    intervalUnit: row.interval_unit,
    technicianId: row.technician_id ?? undefined,
    technicianName: row.technician?.name,
    isActive: row.is_active,
    isArchived: row.is_archived,
    lastCompletedDate: row.last_completed_date ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapRepairRecordRow(row: RepairRecordRow & { machine: MachineRef }): RepairRecord {
  return {
    id: row.id,
    machineId: row.machine_id,
    machineName: row.machine.name,
    machineCode: row.machine.code,
    status: row.status,
    reportedDate: row.reported_date,
    startDate: row.start_date ?? undefined,
    completedDate: row.completed_date ?? undefined,
    reportedBy: row.reported_by,
    assignedTo: row.assigned_to ?? undefined,
    description: row.description,
    diagnosis: row.diagnosis ?? undefined,
    resolution: row.resolution ?? undefined,
    partsUsed: row.parts_used ?? undefined,
    downtimeHours: row.downtime_hours === null ? undefined : Number(row.downtime_hours),
    remarks: row.remarks ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapAttachmentRow(row: AttachmentRow): Attachment {
  return {
    id: row.id,
    entityId: row.entity_id,
    entityType: row.entity_type,
    fileName: row.file_name,
    fileType: row.file_type,
    fileSize: row.file_size,
    uploadedBy: row.uploaded_by,
    uploadedAt: row.uploaded_at,
    url: row.url,
  };
}

/** `due_state()` already returns exactly the frontend's four string values. */
export function mapDueState(value: string): DueState {
  return value as DueState;
}
