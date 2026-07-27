import {
  mockAttachments,
  mockAuditLogs,
  mockDepartments,
  mockMaintenancePlans,
  mockMaintenanceRecords,
  mockMachines,
  mockPartReplacements,
  mockParts,
  mockRepairRecords,
  mockTechnicians,
  mockUsers,
} from './mock-data';
import { isDueSoon, isOverdue } from './maintenance-window';
import { isOpenMaintenance, maintenanceDueState } from './maintenance-record';
import { partLifeState } from './part-life';
import type { Technician } from './mock-data';
import type {
  AccessScope,
  Attachment,
  AttachmentInput,
  AuditLog,
  Department,
  DepartmentSummary,
  Machine,
  MachineInput,
  MachinePart,
  MachinePartInput,
  MaintenancePlan,
  MaintenancePlanInput,
  MaintenanceRecord,
  MaintenanceRecordInput,
  MaintenanceSummary,
  MutationResult,
  PartReplacement,
  PartReplacementInput,
  PartsSummary,
  RepairRecord,
  RepairRecordInput,
  RepairSummary,
  Role,
  UserProfile,
} from './types';

/**
 * Temporary in-memory boundary that stands in for the future Supabase data layer.
 *
 * Every method Supabase must eventually replace lives here, so pages never import
 * or mutate the fixture arrays in `mock-data.ts` directly. Reads return deep copies;
 * writes bump a version counter that `useMockRepository` subscribes to.
 */
export interface MockRepository {
  // Reads
  findUserByEmail(email: string): UserProfile | undefined;
  findUserByRole(role: Role): UserProfile | undefined;
  listUsers(): UserProfile[];
  listTechnicians(): Technician[];
  listDepartments(): Department[];
  /** Departments the caller may reach, in display order. */
  listDepartmentsInScope(scope: AccessScope): Department[];
  isDepartmentInScope(departmentId: string, scope: AccessScope): boolean;
  /** Unscoped. Use `listMachinesInScope` for anything a user sees. */
  listMachines(): Machine[];
  listMachinesInScope(scope: AccessScope): Machine[];
  listMachinesForDepartment(departmentId: string, scope: AccessScope): Machine[];
  getDepartmentSummary(departmentId: string, scope: AccessScope): DepartmentSummary;
  /** Unscoped. Use `getMachineInScope` for anything a user sees. */
  getMachine(machineId: string): Machine | undefined;
  getMachineInScope(machineId: string, scope: AccessScope): Machine | undefined;
  isMachineCodeTaken(code: string, excludeMachineId?: string): boolean;
  /** Unscoped. Use `listMaintenanceInScope` for anything a user sees. */
  listMaintenanceRecords(): MaintenanceRecord[];
  listMaintenanceInScope(scope: AccessScope): MaintenanceRecord[];
  listMaintenanceForDepartment(departmentId: string, scope: AccessScope): MaintenanceRecord[];
  listMaintenanceForMachine(machineId: string): MaintenanceRecord[];
  getMaintenanceRecordInScope(recordId: string, scope: AccessScope): MaintenanceRecord | undefined;
  getMaintenanceSummary(departmentId: string, scope: AccessScope): MaintenanceSummary;
  /** Unscoped read for a machine's plans; callers must already hold a scoped machine. */
  listMaintenancePlansForMachine(machineId: string): MaintenancePlan[];
  listMaintenancePlansForDepartment(departmentId: string, scope: AccessScope): MaintenancePlan[];
  getMaintenancePlanInScope(planId: string, scope: AccessScope): MaintenancePlan | undefined;

  // Maintenance record writes
  createMaintenanceRecord(
    input: MaintenanceRecordInput,
    actorId: string,
  ): MutationResult<MaintenanceRecord>;
  updateMaintenanceRecord(
    recordId: string,
    input: MaintenanceRecordInput,
    actorId: string,
  ): MutationResult<MaintenanceRecord>;
  startMaintenanceRecord(recordId: string, actorId: string): MutationResult<MaintenanceRecord>;
  completeMaintenanceRecord(
    recordId: string,
    actorId: string,
    details: { actions?: string; findings?: string; durationHours?: number },
  ): MutationResult<MaintenanceRecord>;
  cancelMaintenanceRecord(
    recordId: string,
    actorId: string,
    reason?: string,
  ): MutationResult<MaintenanceRecord>;
  /** Reopens a completed record back to in-progress, audited as a distinct action. */
  reopenMaintenanceRecord(recordId: string, actorId: string): MutationResult<MaintenanceRecord>;

  // Maintenance plan writes
  createMaintenancePlan(
    input: MaintenancePlanInput,
    actorId: string,
  ): MutationResult<MaintenancePlan>;
  updateMaintenancePlan(
    planId: string,
    input: MaintenancePlanInput,
    actorId: string,
  ): MutationResult<MaintenancePlan>;
  archiveMaintenancePlan(planId: string, actorId: string): MutationResult<MaintenancePlan>;
  restoreMaintenancePlan(planId: string, actorId: string): MutationResult<MaintenancePlan>;
  /** Unscoped. Use `listRepairsInScope` for anything a user sees. */
  listRepairRecords(): RepairRecord[];
  listRepairsInScope(scope: AccessScope): RepairRecord[];
  listRepairsForDepartment(departmentId: string, scope: AccessScope): RepairRecord[];
  listRepairsForMachine(machineId: string): RepairRecord[];
  getRepairRecordInScope(repairId: string, scope: AccessScope): RepairRecord | undefined;
  getRepairSummary(departmentId: string, scope: AccessScope): RepairSummary;
  listRepairAttachments(repairId: string): Attachment[];
  createRepairRecord(input: RepairRecordInput, actorId: string): MutationResult<RepairRecord>;
  updateRepairRecord(
    repairId: string,
    input: RepairRecordInput,
    actorId: string,
  ): MutationResult<RepairRecord>;
  startRepairRecord(repairId: string, actorId: string): MutationResult<RepairRecord>;
  waitForRepairParts(repairId: string, actorId: string): MutationResult<RepairRecord>;
  completeRepairRecord(
    repairId: string,
    actorId: string,
    details: { diagnosis: string; resolution: string; downtimeHours?: number },
  ): MutationResult<RepairRecord>;
  cancelRepairRecord(
    repairId: string,
    actorId: string,
    reason?: string,
  ): MutationResult<RepairRecord>;
  addRepairAttachment(
    repairId: string,
    input: AttachmentInput,
    actorId: string,
  ): MutationResult<Attachment>;
  removeRepairAttachment(
    repairId: string,
    attachmentId: string,
    actorId: string,
  ): MutationResult<Attachment>;
  /** Unscoped. Use `listPartsInScope` for anything a user sees. */
  listParts(): MachinePart[];
  listPartsInScope(scope: AccessScope): MachinePart[];
  listPartsForDepartment(departmentId: string, scope: AccessScope): MachinePart[];
  listPartsForMachine(machineId: string): MachinePart[];
  getPartInScope(partId: string, scope: AccessScope): MachinePart | undefined;
  isPartSerialTaken(serialNumber: string, excludePartId?: string): boolean;
  getPartsSummary(departmentId: string, scope: AccessScope): PartsSummary;
  listPartReplacements(partId: string): PartReplacement[];
  getPartImage(partId: string): Attachment | undefined;

  // Installed-part writes
  createPart(input: MachinePartInput, actorId: string): MutationResult<MachinePart>;
  updatePart(partId: string, input: MachinePartInput, actorId: string): MutationResult<MachinePart>;
  archivePart(partId: string, actorId: string): MutationResult<MachinePart>;
  restorePart(partId: string, actorId: string): MutationResult<MachinePart>;
  /** Records a replacement and re-fits the component with a new serial and date. */
  replacePart(
    partId: string,
    input: PartReplacementInput,
    actorId: string,
  ): MutationResult<MachinePart>;
  /** One image per part: setting replaces any existing image. */
  setPartImage(partId: string, input: AttachmentInput, actorId: string): MutationResult<Attachment>;
  removePartImage(partId: string, actorId: string): MutationResult<Attachment>;
  listAuditLogs(): AuditLog[];
  listAuditLogsForEntity(entityId: string): AuditLog[];
  getMachineImage(machineId: string): Attachment | undefined;

  // Machine writes
  createMachine(input: MachineInput, actorId: string): MutationResult<Machine>;
  updateMachine(machineId: string, input: MachineInput, actorId: string): MutationResult<Machine>;
  archiveMachine(machineId: string, actorId: string): MutationResult<Machine>;
  restoreMachine(machineId: string, actorId: string): MutationResult<Machine>;

  // Machine image writes. One image per machine: setting replaces any existing image.
  setMachineImage(
    machineId: string,
    input: AttachmentInput,
    actorId: string,
  ): MutationResult<Attachment>;
  removeMachineImage(machineId: string, actorId: string): MutationResult<Attachment>;

  // Reactivity and test support
  subscribe(listener: () => void): () => void;
  getVersion(): number;
  reset(): void;
}

interface MockRepositoryState {
  users: UserProfile[];
  departments: Department[];
  machines: Machine[];
  maintenanceRecords: MaintenanceRecord[];
  maintenancePlans: MaintenancePlan[];
  repairRecords: RepairRecord[];
  parts: MachinePart[];
  partReplacements: PartReplacement[];
  attachments: Attachment[];
  auditLogs: AuditLog[];
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function createFixtureState(): MockRepositoryState {
  return {
    users: Object.values(mockUsers),
    departments: mockDepartments,
    machines: mockMachines,
    maintenanceRecords: mockMaintenanceRecords,
    maintenancePlans: mockMaintenancePlans,
    repairRecords: mockRepairRecords,
    parts: mockParts,
    partReplacements: mockPartReplacements,
    attachments: mockAttachments,
    auditLogs: mockAuditLogs,
  };
}

function failure<T>(
  reason: Extract<MutationResult<T>, { ok: false }>['reason'],
  message: string,
): MutationResult<T> {
  return { ok: false, reason, message };
}

const statusLabels: Record<Machine['status'], string> = {
  active: 'Active',
  inactive: 'Inactive',
  under_maintenance: 'Under maintenance',
  under_repair: 'Under repair',
  retired: 'Retired',
};

export function createMockRepository(): MockRepository {
  let state = clone(createFixtureState());
  let version = 0;
  const listeners = new Set<() => void>();

  function notify(): void {
    version += 1;
    listeners.forEach((listener) => listener());
  }

  function recordAudit(
    entityId: string,
    action: string,
    actorId: string,
    changes: string,
    occurredAt: string,
    entityType: string = 'machine',
  ): void {
    state.auditLogs.unshift({
      id: `audit-${crypto.randomUUID()}`,
      entityId,
      entityType,
      action,
      performedBy: actorId,
      performedAt: occurredAt,
      changes,
    });
  }

  function findMachine(machineId: string): Machine | undefined {
    return state.machines.find((candidate) => candidate.id === machineId);
  }

  function codeExists(code: string, excludeMachineId?: string): boolean {
    const normalized = code.trim().toLowerCase();
    return state.machines.some(
      (candidate) =>
        candidate.id !== excludeMachineId && candidate.code.trim().toLowerCase() === normalized,
    );
  }

  /** Applies the caller's department allow-list and archived visibility. */
  function visibleTo(machine: Machine, scope: AccessScope): boolean {
    if (!scope.departmentIds.includes(machine.departmentId)) return false;
    if (machine.isArchived && !scope.includeArchived) return false;
    return true;
  }

  /** Part serial numbers are unique across all parts (confirmed 2026-07-26). */
  function serialExists(serialNumber: string, excludePartId?: string): boolean {
    const normalized = serialNumber.trim().toLowerCase();
    if (!normalized) return false;
    return state.parts.some(
      (candidate) =>
        candidate.id !== excludePartId &&
        (candidate.serialNumber ?? '').trim().toLowerCase() === normalized,
    );
  }

  function findPart(partId: string): MachinePart | undefined {
    return state.parts.find((candidate) => candidate.id === partId);
  }

  /** Applies a part input onto a part row, resolving denormalized machine fields. */
  function assignPart(part: MachinePart, input: MachinePartInput, machine: Machine): void {
    part.machineId = machine.id;
    part.machineName = machine.name;
    part.machineCode = machine.code;
    part.partCode = input.partCode.trim();
    part.partName = input.partName.trim();
    part.category = input.category.trim();
    part.serialNumber = input.serialNumber?.trim() || undefined;
    part.quantity = input.quantity;
    part.unit = input.unit.trim();
    part.positionOnMachine = input.positionOnMachine.trim();
    part.fittedDate = input.fittedDate;
    part.expectedLifeMonths = input.expectedLifeMonths || undefined;
    part.notes = input.notes.trim();
  }

  /**
   * Ids of machines the caller may read. Child records inherit their parent machine's
   * department and archived state, which is how RLS will express this later: a
   * maintenance or repair row is visible only when its machine is.
   */
  function visibleMachineIds(scope: AccessScope, departmentId?: string): Set<string> {
    return new Set(
      state.machines
        .filter(
          (machine) =>
            visibleTo(machine, scope) &&
            (departmentId === undefined || machine.departmentId === departmentId),
        )
        .map((machine) => machine.id),
    );
  }

  /** The single image for one machine, if it has one. */
  function findMachineImage(machineId: string): Attachment | undefined {
    return state.attachments.find(
      (candidate) => candidate.entityType === 'machine' && candidate.entityId === machineId,
    );
  }

  /** Describes a machine edit in human terms for the activity timeline. */
  function describeChanges(before: Machine, after: Machine): string {
    const tracked: Array<[label: string, before: unknown, after: unknown]> = [
      ['Code', before.code, after.code],
      ['Name', before.name, after.name],
      ['Department', before.department, after.department],
      ['Type', before.type, after.type],
      ['Manufacturer', before.manufacturer, after.manufacturer],
      ['Model', before.model, after.model],
      ['Serial number', before.serialNumber, after.serialNumber],
      ['Status', statusLabels[before.status], statusLabels[after.status]],
      ['Location', before.location, after.location],
      ['Installation date', before.installationDate, after.installationDate],
      ['Next maintenance', before.nextMaintenanceDate, after.nextMaintenanceDate],
    ];

    const changed = tracked
      .filter(([, previous, next]) => previous !== next)
      .map(
        ([label, previous, next]) =>
          `${label}: ${String(previous || '—')} → ${String(next || '—')}`,
      );

    return changed.length > 0
      ? `Updated ${changed.join('; ')}.`
      : 'Saved machine details with no field changes.';
  }

  function findMaintenanceRecord(recordId: string): MaintenanceRecord | undefined {
    return state.maintenanceRecords.find((candidate) => candidate.id === recordId);
  }

  function findMaintenancePlan(planId: string): MaintenancePlan | undefined {
    return state.maintenancePlans.find((candidate) => candidate.id === planId);
  }

  function findRepairRecord(repairId: string): RepairRecord | undefined {
    return state.repairRecords.find((candidate) => candidate.id === repairId);
  }

  function isOpenRepair(record: RepairRecord): boolean {
    return record.status !== 'completed' && record.status !== 'cancelled';
  }

  function assignRepairRecord(
    record: RepairRecord,
    input: RepairRecordInput,
    machine: Machine,
  ): void {
    record.machineId = machine.id;
    record.machineName = machine.name;
    record.machineCode = machine.code;
    record.reportedDate = input.reportedDate;
    record.reportedBy = input.reportedBy.trim();
    record.assignedTo = input.assignedTo?.trim() || undefined;
    record.description = input.description.trim();
    record.diagnosis = input.diagnosis?.trim() || undefined;
    record.resolution = input.resolution?.trim() || undefined;
    record.partsUsed = input.partsUsed?.trim() || undefined;
    record.downtimeHours = input.downtimeHours;
    record.remarks = input.remarks?.trim() || undefined;
  }

  /**
   * Recomputes a machine's effective status from its open maintenance/repair records
   * (confirmed 2026-07-26). Never set directly: every maintenance/repair transition
   * calls this instead, so the machine's status cannot drift from the records that
   * justify it. An open repair takes precedence over an open maintenance record.
   *
   * Simplification, carried forward deliberately: completing or cancelling the last
   * open record always returns the machine to `active`, even if it was `inactive`
   * beforehand. Restoring a machine's prior non-service state is out of scope here.
   */
  function recomputeMachineStatus(machineId: string, actorId: string, occurredAt: string): void {
    const machine = findMachine(machineId);
    if (!machine || machine.isArchived) return;

    const hasOpenRepair = state.repairRecords.some(
      (record) =>
        record.machineId === machineId &&
        record.status !== 'completed' &&
        record.status !== 'cancelled',
    );
    const hasOpenMaintenance = state.maintenanceRecords.some(
      (record) => record.machineId === machineId && isOpenMaintenance(record),
    );

    let nextStatus = machine.status;
    if (hasOpenRepair) {
      nextStatus = 'under_repair';
    } else if (hasOpenMaintenance) {
      nextStatus = 'under_maintenance';
    } else if (machine.status === 'under_repair' || machine.status === 'under_maintenance') {
      nextStatus = 'active';
    }

    if (nextStatus === machine.status) return;

    const previousStatus = machine.status;
    machine.status = nextStatus;
    machine.updatedAt = occurredAt;
    recordAudit(
      machineId,
      'status_changed',
      actorId,
      `Status changed from ${statusLabels[previousStatus]} to ${statusLabels[nextStatus]}, derived from open maintenance/repair records.`,
      occurredAt,
    );
  }

  /** Applies a maintenance input onto a record, resolving denormalized machine fields. */
  function assignMaintenanceRecord(
    record: MaintenanceRecord,
    input: MaintenanceRecordInput,
    machine: Machine,
  ): void {
    record.machineId = machine.id;
    record.machineName = machine.name;
    record.machineCode = machine.code;
    record.planId = input.planId;
    record.type = input.type;
    record.scheduledDate = input.scheduledDate;
    record.technicianId = input.technicianId;
    record.technicianName = input.technicianName.trim();
    record.description = input.description.trim();
    record.findings = input.findings?.trim() || undefined;
    record.actions = input.actions?.trim() || undefined;
    record.partsUsed = input.partsUsed?.trim() || undefined;
    record.durationHours = input.durationHours || undefined;
    record.remarks = input.remarks?.trim() || undefined;
  }

  /** Applies a plan input onto a plan row, resolving denormalized machine fields. */
  function assignMaintenancePlan(
    plan: MaintenancePlan,
    input: MaintenancePlanInput,
    machine: Machine,
  ): void {
    plan.machineId = machine.id;
    plan.machineName = machine.name;
    plan.machineCode = machine.code;
    plan.type = input.type;
    plan.description = input.description.trim();
    plan.intervalValue = input.intervalValue;
    plan.intervalUnit = input.intervalUnit;
    plan.technicianId = input.technicianId;
    plan.technicianName = input.technicianName?.trim() || undefined;
    plan.isActive = input.isActive;
  }

  return {
    findUserByEmail(email) {
      const user = state.users.find(
        (candidate) => candidate.email.toLowerCase() === email.toLowerCase(),
      );
      return user ? clone(user) : undefined;
    },
    findUserByRole(role) {
      const user = state.users.find((candidate) => candidate.role === role);
      return user ? clone(user) : undefined;
    },
    listUsers: () => clone(state.users),
    listTechnicians: () => clone(mockTechnicians),
    listDepartments: () => clone(state.departments),
    listDepartmentsInScope(scope) {
      return clone(
        state.departments.filter((department) => scope.departmentIds.includes(department.id)),
      );
    },
    isDepartmentInScope: (departmentId, scope) => scope.departmentIds.includes(departmentId),
    listMachinesInScope(scope) {
      return clone(state.machines.filter((machine) => visibleTo(machine, scope)));
    },
    listMachinesForDepartment(departmentId, scope) {
      if (!scope.departmentIds.includes(departmentId)) return [];
      return clone(
        state.machines.filter(
          (machine) => machine.departmentId === departmentId && visibleTo(machine, scope),
        ),
      );
    },
    getDepartmentSummary(departmentId, scope) {
      const machines = state.machines.filter(
        (machine) => machine.departmentId === departmentId && visibleTo(machine, scope),
      );
      const countBy = (status: Machine['status']) =>
        machines.filter((machine) => machine.status === status).length;

      return {
        departmentId,
        total: machines.length,
        active: countBy('active'),
        inactive: countBy('inactive'),
        underMaintenance: countBy('under_maintenance'),
        underRepair: countBy('under_repair'),
        retired: countBy('retired'),
        // Due states only apply to machines still in service.
        dueSoon: machines.filter(
          (machine) => machine.status === 'active' && isDueSoon(machine.nextMaintenanceDate),
        ).length,
        overdue: machines.filter(
          (machine) =>
            machine.status !== 'retired' &&
            machine.status !== 'under_maintenance' &&
            machine.status !== 'under_repair' &&
            isOverdue(machine.nextMaintenanceDate),
        ).length,
      };
    },
    listMachines: () => clone(state.machines),
    getMachine(machineId) {
      const machine = findMachine(machineId);
      return machine ? clone(machine) : undefined;
    },
    getMachineInScope(machineId, scope) {
      const machine = findMachine(machineId);
      if (!machine || !visibleTo(machine, scope)) return undefined;
      return clone(machine);
    },
    isMachineCodeTaken: (code, excludeMachineId) => codeExists(code, excludeMachineId),
    listMaintenanceRecords: () => clone(state.maintenanceRecords),
    listMaintenanceInScope(scope) {
      const allowed = visibleMachineIds(scope);
      return clone(
        state.maintenanceRecords
          .filter((record) => allowed.has(record.machineId))
          .sort(
            (a, b) => new Date(b.scheduledDate).getTime() - new Date(a.scheduledDate).getTime(),
          ),
      );
    },
    listMaintenanceForDepartment(departmentId, scope) {
      if (!scope.departmentIds.includes(departmentId)) return [];
      const allowed = visibleMachineIds(scope, departmentId);
      return clone(
        state.maintenanceRecords
          .filter((record) => allowed.has(record.machineId))
          .sort(
            (a, b) => new Date(b.scheduledDate).getTime() - new Date(a.scheduledDate).getTime(),
          ),
      );
    },
    listMaintenanceForMachine(machineId) {
      return clone(
        state.maintenanceRecords
          .filter((record) => record.machineId === machineId)
          .sort(
            (a, b) => new Date(b.scheduledDate).getTime() - new Date(a.scheduledDate).getTime(),
          ),
      );
    },
    getMaintenanceRecordInScope(recordId, scope) {
      const record = findMaintenanceRecord(recordId);
      if (!record) return undefined;
      const machine = findMachine(record.machineId);
      if (!machine || !visibleTo(machine, scope)) return undefined;
      return clone(record);
    },
    getMaintenanceSummary(departmentId, scope) {
      if (!scope.departmentIds.includes(departmentId)) {
        return { scheduled: 0, inProgress: 0, completed: 0, cancelled: 0, dueSoon: 0, overdue: 0 };
      }
      const allowed = visibleMachineIds(scope, departmentId);
      const records = state.maintenanceRecords.filter((record) => allowed.has(record.machineId));
      const countBy = (status: MaintenanceRecord['status']) =>
        records.filter((record) => record.status === status).length;

      return {
        scheduled: countBy('scheduled'),
        inProgress: countBy('in_progress'),
        completed: countBy('completed'),
        cancelled: countBy('cancelled'),
        dueSoon: records.filter((record) => maintenanceDueState(record) === 'due_soon').length,
        overdue: records.filter((record) => maintenanceDueState(record) === 'overdue').length,
      };
    },
    listMaintenancePlansForMachine(machineId) {
      return clone(state.maintenancePlans.filter((plan) => plan.machineId === machineId));
    },
    listMaintenancePlansForDepartment(departmentId, scope) {
      if (!scope.departmentIds.includes(departmentId)) return [];
      const allowed = visibleMachineIds(scope, departmentId);
      return clone(state.maintenancePlans.filter((plan) => allowed.has(plan.machineId)));
    },
    getMaintenancePlanInScope(planId, scope) {
      const plan = findMaintenancePlan(planId);
      if (!plan) return undefined;
      const machine = findMachine(plan.machineId);
      if (!machine || !visibleTo(machine, scope)) return undefined;
      return clone(plan);
    },

    createMaintenanceRecord(input, actorId) {
      const machine = findMachine(input.machineId);
      if (!machine) {
        return failure('unknown_machine', 'Select the machine this maintenance applies to.');
      }
      if (machine.isArchived) {
        return failure('already_archived', 'Archived machines do not accept new maintenance.');
      }
      if (input.planId && !findMaintenancePlan(input.planId)) {
        return failure('not_found', 'The maintenance plan for this record no longer exists.');
      }

      const occurredAt = new Date().toISOString();
      const record: MaintenanceRecord = {
        id: `maintenance-${crypto.randomUUID()}`,
        machineId: machine.id,
        machineName: machine.name,
        machineCode: machine.code,
        type: input.type,
        status: 'scheduled',
        scheduledDate: input.scheduledDate,
        technicianId: input.technicianId,
        technicianName: input.technicianName,
        description: input.description,
        createdAt: occurredAt,
        updatedAt: occurredAt,
      };
      assignMaintenanceRecord(record, input, machine);

      state.maintenanceRecords.unshift(record);
      recordAudit(
        record.id,
        'maintenance_scheduled',
        actorId,
        `Scheduled ${record.type} maintenance on ${machine.code} for ${record.scheduledDate.slice(0, 10)}.`,
        occurredAt,
        'maintenance',
      );
      notify();

      return { ok: true, data: clone(record) };
    },

    updateMaintenanceRecord(recordId, input, actorId) {
      const record = findMaintenanceRecord(recordId);
      if (!record) return failure('not_found', 'This maintenance record no longer exists.');
      if (!isOpenMaintenance(record)) {
        return failure(
          'invalid_state',
          'Completed or cancelled records are read-only. Reopen the record before editing.',
        );
      }
      const machine = findMachine(input.machineId);
      if (!machine) {
        return failure('unknown_machine', 'Select the machine this maintenance applies to.');
      }

      const occurredAt = new Date().toISOString();
      assignMaintenanceRecord(record, input, machine);
      record.updatedAt = occurredAt;

      recordAudit(
        record.id,
        'maintenance_updated',
        actorId,
        `Updated ${record.type} maintenance on ${machine.code}.`,
        occurredAt,
        'maintenance',
      );
      notify();

      return { ok: true, data: clone(record) };
    },

    startMaintenanceRecord(recordId, actorId) {
      const record = findMaintenanceRecord(recordId);
      if (!record) return failure('not_found', 'This maintenance record no longer exists.');
      if (record.status !== 'scheduled') {
        return failure('invalid_state', 'Only a scheduled record can be started.');
      }

      const occurredAt = new Date().toISOString();
      record.status = 'in_progress';
      record.updatedAt = occurredAt;

      recordAudit(
        record.id,
        'maintenance_started',
        actorId,
        `Started ${record.type} maintenance on ${record.machineCode}.`,
        occurredAt,
        'maintenance',
      );
      recomputeMachineStatus(record.machineId, actorId, occurredAt);
      notify();

      return { ok: true, data: clone(record) };
    },

    completeMaintenanceRecord(recordId, actorId, details) {
      const record = findMaintenanceRecord(recordId);
      if (!record) return failure('not_found', 'This maintenance record no longer exists.');
      if (!isOpenMaintenance(record)) {
        return failure('invalid_state', 'Only a scheduled or in-progress record can be completed.');
      }

      const occurredAt = new Date().toISOString();
      record.status = 'completed';
      record.completedDate = occurredAt;
      record.updatedAt = occurredAt;
      if (details.actions?.trim()) record.actions = details.actions.trim();
      if (details.findings?.trim()) record.findings = details.findings.trim();
      if (details.durationHours) record.durationHours = details.durationHours;

      const machine = findMachine(record.machineId);
      if (machine) {
        machine.lastMaintenanceDate = occurredAt;
        machine.updatedAt = occurredAt;
      }
      if (record.planId) {
        const plan = findMaintenancePlan(record.planId);
        if (plan) {
          plan.lastCompletedDate = occurredAt;
          plan.updatedAt = occurredAt;
        }
      }

      recordAudit(
        record.id,
        'maintenance_completed',
        actorId,
        `Completed ${record.type} maintenance on ${record.machineCode}.`,
        occurredAt,
        'maintenance',
      );
      recomputeMachineStatus(record.machineId, actorId, occurredAt);
      notify();

      return { ok: true, data: clone(record) };
    },

    cancelMaintenanceRecord(recordId, actorId, reason) {
      const record = findMaintenanceRecord(recordId);
      if (!record) return failure('not_found', 'This maintenance record no longer exists.');
      if (!isOpenMaintenance(record)) {
        return failure('invalid_state', 'Only a scheduled or in-progress record can be cancelled.');
      }

      const occurredAt = new Date().toISOString();
      record.status = 'cancelled';
      record.updatedAt = occurredAt;
      if (reason?.trim()) record.remarks = reason.trim();

      recordAudit(
        record.id,
        'maintenance_cancelled',
        actorId,
        `Cancelled ${record.type} maintenance on ${record.machineCode}.${reason ? ` ${reason.trim()}` : ''}`,
        occurredAt,
        'maintenance',
      );
      recomputeMachineStatus(record.machineId, actorId, occurredAt);
      notify();

      return { ok: true, data: clone(record) };
    },

    reopenMaintenanceRecord(recordId, actorId) {
      const record = findMaintenanceRecord(recordId);
      if (!record) return failure('not_found', 'This maintenance record no longer exists.');
      if (record.status !== 'completed') {
        return failure('invalid_state', 'Only a completed record can be reopened.');
      }

      const occurredAt = new Date().toISOString();
      record.status = 'in_progress';
      record.completedDate = undefined;
      record.updatedAt = occurredAt;

      recordAudit(
        record.id,
        'maintenance_reopened',
        actorId,
        `Reopened ${record.type} maintenance on ${record.machineCode}.`,
        occurredAt,
        'maintenance',
      );
      recomputeMachineStatus(record.machineId, actorId, occurredAt);
      notify();

      return { ok: true, data: clone(record) };
    },

    createMaintenancePlan(input, actorId) {
      const machine = findMachine(input.machineId);
      if (!machine) {
        return failure('unknown_machine', 'Select the machine this plan applies to.');
      }
      if (machine.isArchived) {
        return failure('already_archived', 'Archived machines do not accept new plans.');
      }

      const occurredAt = new Date().toISOString();
      const plan: MaintenancePlan = {
        id: `plan-${crypto.randomUUID()}`,
        machineId: machine.id,
        machineName: machine.name,
        machineCode: machine.code,
        type: input.type,
        description: '',
        intervalValue: input.intervalValue,
        intervalUnit: input.intervalUnit,
        isActive: input.isActive,
        isArchived: false,
        createdAt: occurredAt,
        updatedAt: occurredAt,
      };
      assignMaintenancePlan(plan, input, machine);

      state.maintenancePlans.unshift(plan);
      recordAudit(
        plan.id,
        'plan_created',
        actorId,
        `Created a recurring ${plan.type} plan on ${machine.code}.`,
        occurredAt,
        'maintenance_plan',
      );
      notify();

      return { ok: true, data: clone(plan) };
    },

    updateMaintenancePlan(planId, input, actorId) {
      const plan = findMaintenancePlan(planId);
      if (!plan) return failure('not_found', 'This maintenance plan no longer exists.');
      if (plan.isArchived) {
        return failure('already_archived', 'Archived plans are read-only. Restore it first.');
      }
      const machine = findMachine(input.machineId);
      if (!machine) {
        return failure('unknown_machine', 'Select the machine this plan applies to.');
      }

      const occurredAt = new Date().toISOString();
      assignMaintenancePlan(plan, input, machine);
      plan.updatedAt = occurredAt;

      recordAudit(
        plan.id,
        'plan_updated',
        actorId,
        `Updated the recurring ${plan.type} plan on ${machine.code}.`,
        occurredAt,
        'maintenance_plan',
      );
      notify();

      return { ok: true, data: clone(plan) };
    },

    archiveMaintenancePlan(planId, actorId) {
      const plan = findMaintenancePlan(planId);
      if (!plan) return failure('not_found', 'This maintenance plan no longer exists.');
      if (plan.isArchived) return failure('already_archived', 'This plan is already archived.');

      const occurredAt = new Date().toISOString();
      plan.isArchived = true;
      plan.updatedAt = occurredAt;

      recordAudit(
        plan.id,
        'plan_archived',
        actorId,
        `Archived the recurring ${plan.type} plan on ${plan.machineCode}.`,
        occurredAt,
        'maintenance_plan',
      );
      notify();

      return { ok: true, data: clone(plan) };
    },

    restoreMaintenancePlan(planId, actorId) {
      const plan = findMaintenancePlan(planId);
      if (!plan) return failure('not_found', 'This maintenance plan no longer exists.');
      if (!plan.isArchived) return failure('not_archived', 'This plan is not archived.');

      const occurredAt = new Date().toISOString();
      plan.isArchived = false;
      plan.updatedAt = occurredAt;

      recordAudit(
        plan.id,
        'plan_restored',
        actorId,
        `Restored the recurring ${plan.type} plan on ${plan.machineCode}.`,
        occurredAt,
        'maintenance_plan',
      );
      notify();

      return { ok: true, data: clone(plan) };
    },

    listRepairRecords: () => clone(state.repairRecords),
    listRepairsInScope(scope) {
      const allowed = visibleMachineIds(scope);
      return clone(
        state.repairRecords
          .filter((record) => allowed.has(record.machineId))
          .sort((a, b) => new Date(b.reportedDate).getTime() - new Date(a.reportedDate).getTime()),
      );
    },
    listRepairsForDepartment(departmentId, scope) {
      if (!scope.departmentIds.includes(departmentId)) return [];
      const allowed = visibleMachineIds(scope, departmentId);
      return clone(
        state.repairRecords
          .filter((record) => allowed.has(record.machineId))
          .sort((a, b) => new Date(b.reportedDate).getTime() - new Date(a.reportedDate).getTime()),
      );
    },
    listRepairsForMachine(machineId) {
      return clone(
        state.repairRecords
          .filter((record) => record.machineId === machineId)
          .sort((a, b) => new Date(b.reportedDate).getTime() - new Date(a.reportedDate).getTime()),
      );
    },
    getRepairRecordInScope(repairId, scope) {
      const record = findRepairRecord(repairId);
      if (!record) return undefined;
      const machine = findMachine(record.machineId);
      return machine && visibleTo(machine, scope) ? clone(record) : undefined;
    },
    getRepairSummary(departmentId, scope) {
      const records = this.listRepairsForDepartment(departmentId, scope);
      return {
        reported: records.filter((record) => record.status === 'reported').length,
        inProgress: records.filter((record) => record.status === 'in_progress').length,
        waitingForParts: records.filter((record) => record.status === 'waiting_for_parts').length,
        completed: records.filter((record) => record.status === 'completed').length,
        cancelled: records.filter((record) => record.status === 'cancelled').length,
        downtimeHours: records.reduce((total, record) => total + (record.downtimeHours ?? 0), 0),
      };
    },
    listRepairAttachments(repairId) {
      return clone(
        state.attachments
          .filter(
            (attachment) => attachment.entityType === 'repair' && attachment.entityId === repairId,
          )
          .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()),
      );
    },
    createRepairRecord(input, actorId) {
      const machine = findMachine(input.machineId);
      if (!machine) return failure('unknown_machine', 'Select the machine this repair applies to.');
      if (machine.isArchived) {
        return failure('already_archived', 'Archived machines do not accept new repair reports.');
      }

      const occurredAt = new Date().toISOString();
      const record: RepairRecord = {
        id: `repair-${crypto.randomUUID()}`,
        machineId: machine.id,
        machineName: machine.name,
        machineCode: machine.code,
        status: 'reported',
        reportedDate: input.reportedDate,
        reportedBy: '',
        description: '',
        createdAt: occurredAt,
        updatedAt: occurredAt,
      };
      assignRepairRecord(record, input, machine);
      state.repairRecords.unshift(record);
      recordAudit(
        record.id,
        'repair_reported',
        actorId,
        `Reported repair on ${machine.code}.`,
        occurredAt,
        'repair',
      );
      recomputeMachineStatus(machine.id, actorId, occurredAt);
      notify();
      return { ok: true, data: clone(record) };
    },
    updateRepairRecord(repairId, input, actorId) {
      const record = findRepairRecord(repairId);
      if (!record) return failure('not_found', 'This repair record no longer exists.');
      if (!isOpenRepair(record)) {
        return failure('invalid_state', 'Completed or cancelled repairs are read-only.');
      }
      const machine = findMachine(input.machineId);
      if (!machine) return failure('unknown_machine', 'Select the machine this repair applies to.');
      if (machine.isArchived)
        return failure('already_archived', 'Archived machines are read-only.');

      const occurredAt = new Date().toISOString();
      const previousMachineId = record.machineId;
      assignRepairRecord(record, input, machine);
      record.updatedAt = occurredAt;
      recordAudit(
        record.id,
        'repair_updated',
        actorId,
        `Updated repair on ${machine.code}.`,
        occurredAt,
        'repair',
      );
      recomputeMachineStatus(previousMachineId, actorId, occurredAt);
      recomputeMachineStatus(machine.id, actorId, occurredAt);
      notify();
      return { ok: true, data: clone(record) };
    },
    startRepairRecord(repairId, actorId) {
      const record = findRepairRecord(repairId);
      if (!record) return failure('not_found', 'This repair record no longer exists.');
      if (record.status !== 'reported' && record.status !== 'waiting_for_parts') {
        return failure(
          'invalid_state',
          'Only a reported or waiting-for-parts repair can be started.',
        );
      }
      const occurredAt = new Date().toISOString();
      record.status = 'in_progress';
      record.startDate ??= occurredAt;
      record.updatedAt = occurredAt;
      recordAudit(
        record.id,
        'repair_started',
        actorId,
        `Started repair on ${record.machineCode}.`,
        occurredAt,
        'repair',
      );
      recomputeMachineStatus(record.machineId, actorId, occurredAt);
      notify();
      return { ok: true, data: clone(record) };
    },
    waitForRepairParts(repairId, actorId) {
      const record = findRepairRecord(repairId);
      if (!record) return failure('not_found', 'This repair record no longer exists.');
      if (record.status !== 'in_progress') {
        return failure('invalid_state', 'Only an in-progress repair can wait for parts.');
      }
      const occurredAt = new Date().toISOString();
      record.status = 'waiting_for_parts';
      record.updatedAt = occurredAt;
      recordAudit(
        record.id,
        'repair_waiting_for_parts',
        actorId,
        `Repair on ${record.machineCode} is waiting for parts.`,
        occurredAt,
        'repair',
      );
      recomputeMachineStatus(record.machineId, actorId, occurredAt);
      notify();
      return { ok: true, data: clone(record) };
    },
    completeRepairRecord(repairId, actorId, details) {
      const record = findRepairRecord(repairId);
      if (!record) return failure('not_found', 'This repair record no longer exists.');
      if (record.status !== 'in_progress') {
        return failure('invalid_state', 'Only an in-progress repair can be completed.');
      }
      if (!details.diagnosis.trim() || !details.resolution.trim()) {
        return failure(
          'invalid_state',
          'Diagnosis and resolution are required to complete a repair.',
        );
      }
      const occurredAt = new Date().toISOString();
      record.status = 'completed';
      record.completedDate = occurredAt;
      record.updatedAt = occurredAt;
      record.diagnosis = details.diagnosis.trim();
      record.resolution = details.resolution.trim();
      record.downtimeHours = details.downtimeHours;
      recordAudit(
        record.id,
        'repair_completed',
        actorId,
        `Completed repair on ${record.machineCode}.`,
        occurredAt,
        'repair',
      );
      recomputeMachineStatus(record.machineId, actorId, occurredAt);
      notify();
      return { ok: true, data: clone(record) };
    },
    cancelRepairRecord(repairId, actorId, reason) {
      const record = findRepairRecord(repairId);
      if (!record) return failure('not_found', 'This repair record no longer exists.');
      if (!isOpenRepair(record)) {
        return failure('invalid_state', 'Only an open repair can be cancelled.');
      }
      const occurredAt = new Date().toISOString();
      record.status = 'cancelled';
      record.updatedAt = occurredAt;
      record.remarks = reason?.trim() || record.remarks;
      recordAudit(
        record.id,
        'repair_cancelled',
        actorId,
        `Cancelled repair on ${record.machineCode}.${reason ? ` ${reason.trim()}` : ''}`,
        occurredAt,
        'repair',
      );
      recomputeMachineStatus(record.machineId, actorId, occurredAt);
      notify();
      return { ok: true, data: clone(record) };
    },
    addRepairAttachment(repairId, input, actorId) {
      const record = findRepairRecord(repairId);
      if (!record) return failure('not_found', 'This repair record no longer exists.');
      if (!isOpenRepair(record))
        return failure('invalid_state', 'Closed repairs cannot receive evidence.');
      const occurredAt = new Date().toISOString();
      const attachment: Attachment = {
        id: `attachment-${crypto.randomUUID()}`,
        entityId: repairId,
        entityType: 'repair',
        fileName: input.fileName,
        fileType: input.fileType,
        fileSize: input.fileSize,
        url: input.url,
        uploadedBy: actorId,
        uploadedAt: occurredAt,
      };
      state.attachments.unshift(attachment);
      recordAudit(
        repairId,
        'repair_evidence_added',
        actorId,
        `Added evidence image ${input.fileName}.`,
        occurredAt,
        'repair',
      );
      notify();
      return { ok: true, data: clone(attachment) };
    },
    removeRepairAttachment(repairId, attachmentId, actorId) {
      const record = findRepairRecord(repairId);
      if (!record) return failure('not_found', 'This repair record no longer exists.');
      const index = state.attachments.findIndex(
        (attachment) =>
          attachment.id === attachmentId &&
          attachment.entityId === repairId &&
          attachment.entityType === 'repair',
      );
      if (index < 0) return failure('not_found', 'This evidence image no longer exists.');
      const [attachment] = state.attachments.splice(index, 1);
      const occurredAt = new Date().toISOString();
      recordAudit(
        repairId,
        'repair_evidence_removed',
        actorId,
        `Removed evidence image ${attachment.fileName}.`,
        occurredAt,
        'repair',
      );
      notify();
      return { ok: true, data: clone(attachment) };
    },
    listParts: () => clone(state.parts),
    listPartsInScope(scope) {
      const allowed = visibleMachineIds(scope);
      return clone(
        state.parts.filter(
          (part) => allowed.has(part.machineId) && (scope.includeArchived || !part.isArchived),
        ),
      );
    },
    listPartsForDepartment(departmentId, scope) {
      if (!scope.departmentIds.includes(departmentId)) return [];
      const allowed = visibleMachineIds(scope, departmentId);
      return clone(
        state.parts.filter(
          (part) => allowed.has(part.machineId) && (scope.includeArchived || !part.isArchived),
        ),
      );
    },
    getPartInScope(partId, scope) {
      const part = state.parts.find((candidate) => candidate.id === partId);
      if (!part) return undefined;
      if (part.isArchived && !scope.includeArchived) return undefined;
      const machine = findMachine(part.machineId);
      if (!machine || !visibleTo(machine, scope)) return undefined;
      return clone(part);
    },
    isPartSerialTaken: (serialNumber, excludePartId) => serialExists(serialNumber, excludePartId),
    getPartsSummary(departmentId, scope) {
      if (!scope.departmentIds.includes(departmentId)) {
        return { total: 0, machinesWithParts: 0, categories: 0, dueSoon: 0, overdue: 0 };
      }
      const allowed = visibleMachineIds(scope, departmentId);
      const parts = state.parts.filter(
        (part) => allowed.has(part.machineId) && (scope.includeArchived || !part.isArchived),
      );

      return {
        total: parts.length,
        machinesWithParts: new Set(parts.map((part) => part.machineId)).size,
        categories: new Set(parts.map((part) => part.category)).size,
        dueSoon: parts.filter((part) => partLifeState(part) === 'due_soon').length,
        overdue: parts.filter((part) => partLifeState(part) === 'overdue').length,
      };
    },
    listPartReplacements(partId) {
      return clone(
        state.partReplacements
          .filter((entry) => entry.partId === partId)
          .sort((a, b) => new Date(b.replacedOn).getTime() - new Date(a.replacedOn).getTime()),
      );
    },
    getPartImage(partId) {
      const image = state.attachments.find(
        (candidate) => candidate.entityType === 'part' && candidate.entityId === partId,
      );
      return image ? clone(image) : undefined;
    },
    listPartsForMachine(machineId) {
      return clone(state.parts.filter((part) => part.machineId === machineId));
    },
    listAuditLogs: () => clone(state.auditLogs),
    listAuditLogsForEntity(entityId) {
      return clone(
        state.auditLogs
          .filter((log) => log.entityId === entityId)
          .sort((a, b) => new Date(b.performedAt).getTime() - new Date(a.performedAt).getTime()),
      );
    },
    getMachineImage(machineId) {
      const image = findMachineImage(machineId);
      return image ? clone(image) : undefined;
    },

    createMachine(input, actorId) {
      if (codeExists(input.code)) {
        return failure(
          'duplicate_code',
          `Machine code ${input.code} is already used by another machine.`,
        );
      }

      const department = state.departments.find((candidate) => candidate.id === input.departmentId);
      if (!department) {
        return failure('unknown_department', 'Select a department from the list.');
      }

      const occurredAt = new Date().toISOString();
      const machine: Machine = {
        id: `machine-${crypto.randomUUID()}`,
        code: input.code.trim(),
        name: input.name.trim(),
        department: department.name,
        departmentId: department.id,
        type: input.type,
        manufacturer: input.manufacturer.trim(),
        model: input.model.trim(),
        location: input.location.trim(),
        status: input.status,
        installationDate: input.installationDate,
        lastMaintenanceDate: '',
        nextMaintenanceDate: input.nextMaintenanceDate,
        description: input.description.trim(),
        isArchived: false,
        createdAt: occurredAt,
        updatedAt: occurredAt,
        serialNumber: input.serialNumber?.trim() || undefined,
        capacity: input.capacity?.trim() || undefined,
        powerRating: input.powerRating?.trim() || undefined,
        voltage: input.voltage?.trim() || undefined,
        weight: input.weight?.trim() || undefined,
        plantArea: input.plantArea?.trim() || undefined,
        baySection: input.baySection?.trim() || undefined,
        floor: input.floor?.trim() || undefined,
        roomPosition: input.roomPosition?.trim() || undefined,
      };

      state.machines.unshift(machine);
      recordAudit(
        machine.id,
        'created',
        actorId,
        `Machine ${machine.code} registered in the machine register.`,
        occurredAt,
      );
      notify();

      return { ok: true, data: clone(machine) };
    },

    updateMachine(machineId, input, actorId) {
      const machine = findMachine(machineId);
      if (!machine) {
        return failure('not_found', 'This machine no longer exists in the register.');
      }
      if (machine.isArchived) {
        return failure(
          'already_archived',
          'Archived machines are read-only. Restore the machine before editing it.',
        );
      }
      if (codeExists(input.code, machineId)) {
        return failure(
          'duplicate_code',
          `Machine code ${input.code} is already used by another machine.`,
        );
      }

      const department = state.departments.find((candidate) => candidate.id === input.departmentId);
      if (!department) {
        return failure('unknown_department', 'Select a department from the list.');
      }

      const before = clone(machine);
      const occurredAt = new Date().toISOString();

      machine.code = input.code.trim();
      machine.name = input.name.trim();
      machine.department = department.name;
      machine.departmentId = department.id;
      machine.type = input.type;
      machine.manufacturer = input.manufacturer.trim();
      machine.model = input.model.trim();
      machine.location = input.location.trim();
      machine.status = input.status;
      machine.installationDate = input.installationDate;
      machine.nextMaintenanceDate = input.nextMaintenanceDate;
      machine.description = input.description.trim();
      machine.serialNumber = input.serialNumber?.trim() || undefined;
      machine.capacity = input.capacity?.trim() || undefined;
      machine.powerRating = input.powerRating?.trim() || undefined;
      machine.voltage = input.voltage?.trim() || undefined;
      machine.weight = input.weight?.trim() || undefined;
      machine.plantArea = input.plantArea?.trim() || undefined;
      machine.baySection = input.baySection?.trim() || undefined;
      machine.floor = input.floor?.trim() || undefined;
      machine.roomPosition = input.roomPosition?.trim() || undefined;
      machine.updatedAt = occurredAt;

      recordAudit(machine.id, 'updated', actorId, describeChanges(before, machine), occurredAt);
      notify();

      return { ok: true, data: clone(machine) };
    },

    archiveMachine(machineId, actorId) {
      const machine = findMachine(machineId);
      if (!machine) {
        return failure('not_found', 'This machine no longer exists in the register.');
      }
      if (machine.isArchived) {
        return failure('already_archived', `${machine.code} is already archived.`);
      }

      const occurredAt = new Date().toISOString();
      const previousStatus = machine.status;
      machine.isArchived = true;
      machine.status = 'retired';
      machine.updatedAt = occurredAt;

      recordAudit(
        machine.id,
        'archived',
        actorId,
        `Machine archived and retired from ${statusLabels[previousStatus]}.`,
        occurredAt,
      );
      notify();

      return { ok: true, data: clone(machine) };
    },

    restoreMachine(machineId, actorId) {
      const machine = findMachine(machineId);
      if (!machine) {
        return failure('not_found', 'This machine no longer exists in the register.');
      }
      if (!machine.isArchived) {
        return failure('not_archived', `${machine.code} is already active in the register.`);
      }

      const occurredAt = new Date().toISOString();
      machine.isArchived = false;
      machine.status = 'inactive';
      machine.updatedAt = occurredAt;

      recordAudit(
        machine.id,
        'restored',
        actorId,
        'Machine restored to the active register with status Inactive.',
        occurredAt,
      );
      notify();

      return { ok: true, data: clone(machine) };
    },

    setMachineImage(machineId, input, actorId) {
      const machine = findMachine(machineId);
      if (!machine) {
        return failure('not_found', 'This machine no longer exists in the register.');
      }
      if (machine.isArchived) {
        return failure('already_archived', 'Archived machines do not accept image changes.');
      }

      const occurredAt = new Date().toISOString();
      const existing = findMachineImage(machineId);

      // One image per machine: a new upload replaces the previous one outright.
      if (existing) {
        state.attachments = state.attachments.filter((candidate) => candidate.id !== existing.id);
      }

      const attachment: Attachment = {
        id: `attachment-${crypto.randomUUID()}`,
        entityId: machineId,
        entityType: 'machine',
        fileName: input.fileName,
        fileType: input.fileType,
        fileSize: input.fileSize,
        uploadedBy: actorId,
        uploadedAt: occurredAt,
        url: input.url,
      };

      state.attachments.push(attachment);
      machine.imageUrl = attachment.url;
      machine.updatedAt = occurredAt;

      recordAudit(
        machineId,
        existing ? 'image_replaced' : 'image_set',
        actorId,
        existing
          ? `Replaced machine image ${existing.fileName} with ${attachment.fileName}.`
          : `Set machine image ${attachment.fileName}.`,
        occurredAt,
      );
      notify();

      return { ok: true, data: clone(attachment) };
    },

    removeMachineImage(machineId, actorId) {
      const machine = findMachine(machineId);
      if (!machine) {
        return failure('not_found', 'This machine no longer exists in the register.');
      }
      if (machine.isArchived) {
        return failure('already_archived', 'Archived machines do not accept image changes.');
      }

      const existing = findMachineImage(machineId);
      if (!existing) {
        return failure('not_found', 'This machine has no image to remove.');
      }

      const occurredAt = new Date().toISOString();
      state.attachments = state.attachments.filter((candidate) => candidate.id !== existing.id);
      machine.imageUrl = undefined;
      machine.updatedAt = occurredAt;

      recordAudit(
        machineId,
        'image_removed',
        actorId,
        `Removed machine image ${existing.fileName}.`,
        occurredAt,
      );
      notify();

      return { ok: true, data: clone(existing) };
    },

    createPart(input, actorId) {
      const machine = findMachine(input.machineId);
      if (!machine) {
        return failure('unknown_machine', 'Select the machine this component is fitted to.');
      }
      if (machine.isArchived) {
        return failure('already_archived', 'Archived machines do not accept new parts.');
      }
      if (input.serialNumber && serialExists(input.serialNumber)) {
        return failure(
          'duplicate_serial',
          `Serial number ${input.serialNumber} is already recorded against another part.`,
        );
      }

      const occurredAt = new Date().toISOString();
      const part: MachinePart = {
        id: `part-${crypto.randomUUID()}`,
        machineId: machine.id,
        machineName: machine.name,
        machineCode: machine.code,
        partCode: '',
        partName: '',
        category: '',
        quantity: 0,
        unit: '',
        positionOnMachine: '',
        fittedDate: input.fittedDate,
        notes: '',
        isArchived: false,
        createdAt: occurredAt,
        updatedAt: occurredAt,
      };
      assignPart(part, input, machine);
      part.updatedAt = occurredAt;

      state.parts.unshift(part);
      recordAudit(
        part.id,
        'part_fitted',
        actorId,
        `Fitted ${part.partName} (${part.partCode}) to ${machine.code} at ${part.positionOnMachine}.`,
        occurredAt,
        'part',
      );
      notify();

      return { ok: true, data: clone(part) };
    },

    updatePart(partId, input, actorId) {
      const part = findPart(partId);
      if (!part) {
        return failure('not_found', 'This part is no longer in the register.');
      }
      if (part.isArchived) {
        return failure('already_archived', 'Archived parts are read-only. Restore it first.');
      }
      const machine = findMachine(input.machineId);
      if (!machine) {
        return failure('unknown_machine', 'Select the machine this component is fitted to.');
      }
      if (input.serialNumber && serialExists(input.serialNumber, partId)) {
        return failure(
          'duplicate_serial',
          `Serial number ${input.serialNumber} is already recorded against another part.`,
        );
      }

      const occurredAt = new Date().toISOString();
      assignPart(part, input, machine);
      part.updatedAt = occurredAt;

      recordAudit(
        part.id,
        'part_updated',
        actorId,
        `Updated ${part.partName} (${part.partCode}) on ${machine.code}.`,
        occurredAt,
        'part',
      );
      notify();

      return { ok: true, data: clone(part) };
    },

    archivePart(partId, actorId) {
      const part = findPart(partId);
      if (!part) return failure('not_found', 'This part is no longer in the register.');
      if (part.isArchived)
        return failure('already_archived', `${part.partCode} is already archived.`);

      const occurredAt = new Date().toISOString();
      part.isArchived = true;
      part.updatedAt = occurredAt;

      recordAudit(
        part.id,
        'part_removed',
        actorId,
        `Removed ${part.partName} (${part.partCode}) from ${part.machineCode}. History retained.`,
        occurredAt,
        'part',
      );
      notify();

      return { ok: true, data: clone(part) };
    },

    restorePart(partId, actorId) {
      const part = findPart(partId);
      if (!part) return failure('not_found', 'This part is no longer in the register.');
      if (!part.isArchived) {
        return failure('not_archived', `${part.partCode} is already fitted.`);
      }

      const occurredAt = new Date().toISOString();
      part.isArchived = false;
      part.updatedAt = occurredAt;

      recordAudit(
        part.id,
        'part_restored',
        actorId,
        `Restored ${part.partName} (${part.partCode}) to ${part.machineCode}.`,
        occurredAt,
        'part',
      );
      notify();

      return { ok: true, data: clone(part) };
    },

    replacePart(partId, input, actorId) {
      const part = findPart(partId);
      if (!part) return failure('not_found', 'This part is no longer in the register.');
      if (part.isArchived) {
        return failure('already_archived', 'Restore this part before recording a replacement.');
      }
      if (input.newSerialNumber && serialExists(input.newSerialNumber, partId)) {
        return failure(
          'duplicate_serial',
          `Serial number ${input.newSerialNumber} is already recorded against another part.`,
        );
      }

      const occurredAt = new Date().toISOString();
      const previousSerialNumber = part.serialNumber;

      state.partReplacements.unshift({
        id: `replacement-${crypto.randomUUID()}`,
        partId: part.id,
        machineId: part.machineId,
        replacedOn: input.replacedOn,
        reason: input.reason.trim(),
        previousSerialNumber,
        newSerialNumber: input.newSerialNumber?.trim() || undefined,
        performedBy: actorId,
        notes: input.notes?.trim() || undefined,
      });

      // The component is re-fitted: new serial, and the life clock restarts.
      part.serialNumber = input.newSerialNumber?.trim() || undefined;
      part.fittedDate = input.replacedOn;
      part.updatedAt = occurredAt;

      recordAudit(
        part.id,
        'part_replaced',
        actorId,
        `Replaced ${part.partName} (${part.partCode}) on ${part.machineCode}. ${input.reason.trim()}`,
        occurredAt,
        'part',
      );
      notify();

      return { ok: true, data: clone(part) };
    },

    setPartImage(partId, input, actorId) {
      const part = findPart(partId);
      if (!part) return failure('not_found', 'This part is no longer in the register.');
      if (part.isArchived) {
        return failure('already_archived', 'Archived parts do not accept image changes.');
      }

      const occurredAt = new Date().toISOString();
      const existing = state.attachments.find(
        (candidate) => candidate.entityType === 'part' && candidate.entityId === partId,
      );
      if (existing) {
        state.attachments = state.attachments.filter((candidate) => candidate.id !== existing.id);
      }

      const attachment: Attachment = {
        id: `attachment-${crypto.randomUUID()}`,
        entityId: partId,
        entityType: 'part',
        fileName: input.fileName,
        fileType: input.fileType,
        fileSize: input.fileSize,
        uploadedBy: actorId,
        uploadedAt: occurredAt,
        url: input.url,
      };
      state.attachments.push(attachment);
      part.updatedAt = occurredAt;

      recordAudit(
        partId,
        existing ? 'image_replaced' : 'image_set',
        actorId,
        existing
          ? `Replaced part image ${existing.fileName} with ${attachment.fileName}.`
          : `Set part image ${attachment.fileName}.`,
        occurredAt,
        'part',
      );
      notify();

      return { ok: true, data: clone(attachment) };
    },

    removePartImage(partId, actorId) {
      const part = findPart(partId);
      if (!part) return failure('not_found', 'This part is no longer in the register.');

      const existing = state.attachments.find(
        (candidate) => candidate.entityType === 'part' && candidate.entityId === partId,
      );
      if (!existing) return failure('not_found', 'This part has no image to remove.');

      const occurredAt = new Date().toISOString();
      state.attachments = state.attachments.filter((candidate) => candidate.id !== existing.id);
      part.updatedAt = occurredAt;

      recordAudit(
        partId,
        'image_removed',
        actorId,
        `Removed part image ${existing.fileName}.`,
        occurredAt,
        'part',
      );
      notify();

      return { ok: true, data: clone(existing) };
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getVersion: () => version,
    reset() {
      state = clone(createFixtureState());
      notify();
    },
  };
}

export const mockRepository = createMockRepository();
