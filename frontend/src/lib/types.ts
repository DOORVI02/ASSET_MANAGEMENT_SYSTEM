export type Role = 'officer' | 'supervisor';
export type MachineStatus =
  'active' | 'inactive' | 'under_maintenance' | 'under_repair' | 'retired';
export type MachineType =
  | 'motor'
  | 'pump'
  | 'compressor'
  | 'crane'
  | 'conveyor'
  | 'press'
  | 'mill'
  | 'blower'
  | 'lathe'
  | 'other';
export type MaintenanceType =
  'preventive' | 'corrective' | 'inspection' | 'lubrication' | 'calibration' | 'emergency';
/**
 * `overdue` is deliberately absent: whether a record is overdue is derived from
 * `scheduledDate` against the shared due-soon window, never stored (decision
 * 2026-07-26). A record is either open (`scheduled`/`in_progress`) or closed
 * (`completed`/`cancelled`); "overdue" describes an open record's due state.
 */
export type MaintenanceStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
export type RecurrenceUnit = 'days' | 'weeks' | 'months' | 'years';
export type RepairStatus =
  'reported' | 'in_progress' | 'waiting_for_parts' | 'completed' | 'cancelled';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: Role;
  department: string;
  departmentScope: string[];
  position: string;
  status: 'active' | 'inactive';
  lastLogin: string;
  avatarInitials: string;
}

export type PageState = 'loading' | 'empty' | 'error' | 'confirmation' | 'success' | 'validation';

export interface FeedbackMessage {
  state: Extract<PageState, 'success' | 'validation'>;
  title: string;
  description?: string;
}

export interface TechnicalMeasurement {
  value: number;
  unit: string;
}

export interface MachineTechnicalProfile {
  machineId: string;
  capacity?: TechnicalMeasurement;
  conveyorBeltDesign?: string;
  carryingCapacity?: TechnicalMeasurement;
  gearboxCapacity?: TechnicalMeasurement;
  motorCapacity?: TechnicalMeasurement;
  driveDrumSize?: string;
  tailEndDrumSize?: string;
  driveSnubPulleySize?: string;
  tailSnubPulleySize?: string;
  driveBendPulleySize?: string;
  tailBendPulleySize?: string;
  gravityDrumPulleySize?: string;
  housingNumber?: string;
  plummerBlockSize?: string;
}

/**
 * A maintenance technician. Not an application user — technicians do not sign in, they are
 * simply who a maintenance record or plan credits the work to.
 */
export interface Technician {
  id: string;
  name: string;
}

export interface Department {
  id: string;
  name: string;
  code: string;
  head: string;
  machineCount: number;
}

export interface Machine {
  id: string;
  code: string;
  name: string;
  department: string;
  departmentId: string;
  type: MachineType;
  manufacturer: string;
  model: string;
  location: string;
  status: MachineStatus;
  installationDate: string;
  lastMaintenanceDate: string;
  nextMaintenanceDate: string;
  description: string;
  imageUrl?: string;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
  serialNumber?: string;
  capacity?: string;
  powerRating?: string;
  voltage?: string;
  weight?: string;
  plantArea?: string;
  baySection?: string;
  floor?: string;
  roomPosition?: string;
}

/**
 * A component fitted to one machine.
 *
 * Parts are installed components, not stock inventory (decision 2026-07-25), so there
 * are no minimum-stock levels, stock states, suppliers, unit costs, or restock dates.
 * `quantity` means how many of this component are fitted to the machine.
 */
export interface MachinePart {
  id: string;
  machineId: string;
  /** Denormalized for display; the repository keeps these in step with the machine. */
  machineName: string;
  machineCode: string;
  partCode: string;
  partName: string;
  category: string;
  /** Unique across all parts when present. */
  serialNumber?: string;
  /** How many of this component are fitted. */
  quantity: number;
  unit: string;
  /** Where on the machine the component sits, for example "Drive end bearing housing". */
  positionOnMachine: string;
  fittedDate: string;
  /** Service life in months, used to derive when replacement is due. */
  expectedLifeMonths?: number;
  notes: string;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

/** One entry in a part's replacement history. */
export interface PartReplacement {
  id: string;
  partId: string;
  machineId: string;
  replacedOn: string;
  reason: string;
  previousSerialNumber?: string;
  newSerialNumber?: string;
  performedBy: string;
  notes?: string;
}

/** Derived from `fittedDate` and `expectedLifeMonths`; never stored. */
export type PartLifeState = 'unknown' | 'ok' | 'due_soon' | 'overdue';

/** Fields a user supplies when fitting or editing an installed part. */
export interface MachinePartInput {
  machineId: string;
  partCode: string;
  partName: string;
  category: string;
  serialNumber?: string;
  quantity: number;
  unit: string;
  positionOnMachine: string;
  fittedDate: string;
  expectedLifeMonths?: number;
  notes: string;
}

/** Fields recorded when a fitted component is replaced with a new one. */
export interface PartReplacementInput {
  replacedOn: string;
  reason: string;
  newSerialNumber?: string;
  notes?: string;
}

/** Installed-part counts for one department. */
export interface PartsSummary {
  total: number;
  machinesWithParts: number;
  categories: number;
  dueSoon: number;
  overdue: number;
}

/**
 * One performed or scheduled maintenance instance. Distinct from `MaintenancePlan`,
 * which is the recurring definition a record may originate from — flow.md requires
 * the two stay clearly separate in both UI and types.
 */
export interface MaintenanceRecord {
  id: string;
  machineId: string;
  /** Denormalized for display; kept in step with the machine by the repository. */
  machineName: string;
  machineCode: string;
  /** Set when this record was generated from a recurring plan; absent for ad hoc work. */
  planId?: string;
  type: MaintenanceType;
  status: MaintenanceStatus;
  scheduledDate: string;
  completedDate?: string;
  technicianId: string;
  technicianName: string;
  description: string;
  findings?: string;
  actions?: string;
  partsUsed?: string;
  durationHours?: number;
  remarks?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MaintenanceRecordInput {
  machineId: string;
  planId?: string;
  type: MaintenanceType;
  scheduledDate: string;
  technicianId: string;
  technicianName: string;
  description: string;
  findings?: string;
  actions?: string;
  partsUsed?: string;
  durationHours?: number;
  remarks?: string;
}

/**
 * A recurring maintenance definition for one machine. `nextDueDate` is always derived
 * from `lastCompletedDate` (or `createdAt` if never completed) plus the interval —
 * never stored, so it cannot disagree with the records that satisfy it.
 */
export interface MaintenancePlan {
  id: string;
  machineId: string;
  machineName: string;
  machineCode: string;
  type: MaintenanceType;
  description: string;
  intervalValue: number;
  intervalUnit: RecurrenceUnit;
  technicianId?: string;
  technicianName?: string;
  /** An inactive plan is kept for history but no longer expected to recur. */
  isActive: boolean;
  isArchived: boolean;
  lastCompletedDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MaintenancePlanInput {
  machineId: string;
  type: MaintenanceType;
  description: string;
  intervalValue: number;
  intervalUnit: RecurrenceUnit;
  technicianId?: string;
  technicianName?: string;
  isActive: boolean;
}

/** Due state of an open record or plan, derived from a scheduled/next-due date. */
export type DueState = 'ok' | 'due_soon' | 'overdue' | 'not_applicable';

export interface RepairRecord {
  id: string;
  machineId: string;
  machineName: string;
  machineCode: string;
  status: RepairStatus;
  reportedDate: string;
  startDate?: string;
  completedDate?: string;
  reportedBy: string;
  assignedTo?: string;
  description: string;
  diagnosis?: string;
  resolution?: string;
  /** Free text in the preview contract; it is not a stock or installed-part relation. */
  partsUsed?: string;
  downtimeHours?: number;
  remarks?: string;
  createdAt: string;
  updatedAt: string;
}

/** User-supplied repair fields. Machine display fields and lifecycle dates are repository-derived. */
export interface RepairRecordInput {
  machineId: string;
  reportedDate: string;
  reportedBy: string;
  assignedTo?: string;
  description: string;
  diagnosis?: string;
  resolution?: string;
  partsUsed?: string;
  downtimeHours?: number;
  remarks?: string;
}

export interface Attachment {
  id: string;
  entityId: string;
  entityType: 'machine' | 'part' | 'maintenance' | 'repair';
  fileName: string;
  fileType: string;
  fileSize: number;
  uploadedBy: string;
  uploadedAt: string;
  url: string;
}

/**
 * Fields a user supplies when creating or editing a machine. Denormalized display
 * values (`department`, `machineName`, …) and lifecycle timestamps are derived by
 * the repository, never submitted by the form.
 */
export interface MachineInput {
  code: string;
  name: string;
  departmentId: string;
  type: MachineType;
  manufacturer: string;
  model: string;
  serialNumber?: string;
  capacity?: string;
  powerRating?: string;
  voltage?: string;
  weight?: string;
  installationDate: string;
  location: string;
  plantArea?: string;
  baySection?: string;
  floor?: string;
  roomPosition?: string;
  status: MachineStatus;
  description: string;
  nextMaintenanceDate: string;
}

export interface AttachmentInput {
  fileName: string;
  fileType: string;
  fileSize: number;
  url: string;
}

/**
 * What the current user is allowed to read. Mirrors the RLS predicates that will
 * replace it: a department allow-list plus whether archived rows are visible.
 * Passed into repository reads so scoping is enforced at the data boundary rather
 * than by each page remembering to filter.
 */
export interface AccessScope {
  /** Department ids the caller may read. Empty means no access to any department. */
  departmentIds: string[];
  /** Officers see archived records; Supervisors do not. */
  includeArchived: boolean;
}

/** Machine counts for one department, all derived from the same machine rows. */
export interface DepartmentSummary {
  departmentId: string;
  total: number;
  active: number;
  inactive: number;
  underMaintenance: number;
  underRepair: number;
  retired: number;
  dueSoon: number;
  overdue: number;
}

/** Maintenance record counts for one department. */
export interface MaintenanceSummary {
  scheduled: number;
  inProgress: number;
  completed: number;
  cancelled: number;
  dueSoon: number;
  overdue: number;
}

/** Repair counts and downtime for the current department. */
export interface RepairSummary {
  reported: number;
  inProgress: number;
  waitingForParts: number;
  completed: number;
  cancelled: number;
  downtimeHours: number;
}

export type MutationFailureReason =
  | 'not_found'
  | 'duplicate_code'
  | 'already_archived'
  | 'not_archived'
  | 'unknown_department'
  | 'unknown_machine'
  | 'duplicate_serial'
  | 'out_of_scope'
  | 'invalid_state';

export type MutationResult<T> =
  { ok: true; data: T } | { ok: false; reason: MutationFailureReason; message: string };

export interface AuditLog {
  id: string;
  entityId: string;
  entityType: string;
  action: string;
  performedBy: string;
  performedAt: string;
  changes: string;
}

export interface DashboardSummary {
  totalMachines: number;
  active: number;
  inactive: number;
  underMaintenance: number;
  underRepair: number;
  dueSoon: number;
  overdue: number;
  retired: number;
  recentlyAdded: Machine[];
  needsAttention: Machine[];
  upcomingMaintenance: MaintenanceRecord[];
  recentRepairs: RepairRecord[];
}
