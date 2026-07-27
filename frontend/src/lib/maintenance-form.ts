import { z } from 'zod';
import { toDateInputValue } from './machine-form';
import type {
  MaintenancePlan,
  MaintenancePlanInput,
  MaintenanceRecord,
  MaintenanceRecordInput,
} from './types';

export const maintenanceTypeOptions = [
  'preventive',
  'corrective',
  'inspection',
  'lubrication',
  'calibration',
  'emergency',
] as const;

export const recurrenceUnitOptions = ['days', 'weeks', 'months', 'years'] as const;

const requiredText = (label: string, min: number, max: number) =>
  z
    .string()
    .trim()
    .min(min, min === 1 ? `${label} is required.` : `${label} must be at least ${min} characters.`)
    .max(max, `${label} must be ${max} characters or fewer.`);

export const maintenanceRecordFormSchema = z.object({
  machineId: z.string().min(1, 'Select the machine this maintenance applies to.'),
  planId: z.string().optional(),
  type: z.enum(maintenanceTypeOptions),
  scheduledDate: z
    .string()
    .min(1, 'Scheduled date is required.')
    .refine((value) => !Number.isNaN(new Date(value).getTime()), 'Enter a valid date.'),
  technicianId: z.string().min(1, 'Technician is required.'),
  technicianName: requiredText('Technician name', 2, 60),
  description: requiredText('Description', 3, 500),
  findings: z.string().trim().max(1000, 'Findings must be 1000 characters or fewer.').optional(),
  actions: z.string().trim().max(1000, 'Actions must be 1000 characters or fewer.').optional(),
  partsUsed: z.string().trim().max(300, 'Parts used must be 300 characters or fewer.').optional(),
  durationHours: z
    .number({ invalid_type_error: 'Duration must be a number.' })
    .min(0, 'Duration cannot be negative.')
    .max(999, 'Duration must be 999 hours or fewer.')
    .optional(),
  remarks: z.string().trim().max(500, 'Remarks must be 500 characters or fewer.').optional(),
});

export type MaintenanceRecordFormValues = z.infer<typeof maintenanceRecordFormSchema>;
export type MaintenanceRecordFormErrors = Partial<
  Record<keyof MaintenanceRecordFormValues, string>
>;

export function emptyMaintenanceRecordFormValues(
  machineId = '',
  planId?: string,
): MaintenanceRecordFormValues {
  return {
    machineId,
    planId,
    type: 'preventive',
    scheduledDate: toDateInputValue(new Date().toISOString()),
    technicianId: '',
    technicianName: '',
    description: '',
    findings: '',
    actions: '',
    partsUsed: '',
    durationHours: undefined,
    remarks: '',
  };
}

export function maintenanceRecordToFormValues(
  record: MaintenanceRecord,
): MaintenanceRecordFormValues {
  return {
    machineId: record.machineId,
    planId: record.planId,
    type: record.type,
    scheduledDate: toDateInputValue(record.scheduledDate),
    technicianId: record.technicianId,
    technicianName: record.technicianName,
    description: record.description,
    findings: record.findings ?? '',
    actions: record.actions ?? '',
    partsUsed: record.partsUsed ?? '',
    durationHours: record.durationHours,
    remarks: record.remarks ?? '',
  };
}

export function formValuesToMaintenanceRecordInput(
  values: MaintenanceRecordFormValues,
): MaintenanceRecordInput {
  return {
    machineId: values.machineId,
    planId: values.planId,
    type: values.type,
    scheduledDate: values.scheduledDate,
    technicianId: values.technicianId,
    technicianName: values.technicianName,
    description: values.description,
    findings: values.findings,
    actions: values.actions,
    partsUsed: values.partsUsed,
    durationHours: values.durationHours,
    remarks: values.remarks,
  };
}

export function validateMaintenanceRecordForm(
  values: MaintenanceRecordFormValues,
): MaintenanceRecordFormErrors {
  const result = maintenanceRecordFormSchema.safeParse(values);
  if (result.success) return {};

  const errors: MaintenanceRecordFormErrors = {};
  for (const issue of result.error.issues) {
    const field = issue.path[0];
    if (typeof field === 'string' && !(field in errors)) {
      errors[field as keyof MaintenanceRecordFormValues] = issue.message;
    }
  }
  return errors;
}

export function hasMaintenanceRecordFormChanges(
  a: MaintenanceRecordFormValues,
  b: MaintenanceRecordFormValues,
): boolean {
  return (Object.keys(a) as Array<keyof MaintenanceRecordFormValues>).some(
    (key) => a[key] !== b[key],
  );
}

/** Completion dialog fields, kept separate from the record form itself. */
export const maintenanceCompletionSchema = z.object({
  actions: requiredText('Actions taken', 3, 1000),
  findings: z.string().trim().max(1000, 'Findings must be 1000 characters or fewer.').optional(),
  durationHours: z
    .number({ invalid_type_error: 'Duration must be a number.' })
    .min(0, 'Duration cannot be negative.')
    .max(999, 'Duration must be 999 hours or fewer.')
    .optional(),
});
export type MaintenanceCompletionValues = z.infer<typeof maintenanceCompletionSchema>;

export const maintenanceCancellationSchema = z.object({
  reason: requiredText('Cancellation reason', 3, 300),
});
export type MaintenanceCancellationValues = z.infer<typeof maintenanceCancellationSchema>;

/** Plan form: the recurring definition, not an individual record. */
export const maintenancePlanFormSchema = z.object({
  machineId: z.string().min(1, 'Select the machine this plan applies to.'),
  type: z.enum(maintenanceTypeOptions),
  description: requiredText('Description', 3, 300),
  intervalValue: z
    .number({ invalid_type_error: 'Interval must be a number.' })
    .int('Interval must be a whole number.')
    .min(1, 'Interval must be at least 1.')
    .max(60, 'Interval must be 60 or fewer.'),
  intervalUnit: z.enum(recurrenceUnitOptions),
  technicianId: z.string().optional(),
  technicianName: z
    .string()
    .trim()
    .max(60, 'Technician name must be 60 characters or fewer.')
    .optional(),
  isActive: z.boolean(),
});
export type MaintenancePlanFormValues = z.infer<typeof maintenancePlanFormSchema>;
export type MaintenancePlanFormErrors = Partial<Record<keyof MaintenancePlanFormValues, string>>;

export function emptyMaintenancePlanFormValues(machineId = ''): MaintenancePlanFormValues {
  return {
    machineId,
    type: 'preventive',
    description: '',
    intervalValue: 1,
    intervalUnit: 'months',
    technicianId: '',
    technicianName: '',
    isActive: true,
  };
}

export function maintenancePlanToFormValues(plan: MaintenancePlan): MaintenancePlanFormValues {
  return {
    machineId: plan.machineId,
    type: plan.type,
    description: plan.description,
    intervalValue: plan.intervalValue,
    intervalUnit: plan.intervalUnit,
    technicianId: plan.technicianId ?? '',
    technicianName: plan.technicianName ?? '',
    isActive: plan.isActive,
  };
}

export function formValuesToMaintenancePlanInput(
  values: MaintenancePlanFormValues,
): MaintenancePlanInput {
  return {
    machineId: values.machineId,
    type: values.type,
    description: values.description,
    intervalValue: values.intervalValue,
    intervalUnit: values.intervalUnit,
    technicianId: values.technicianId || undefined,
    technicianName: values.technicianName || undefined,
    isActive: values.isActive,
  };
}

export function validateMaintenancePlanForm(
  values: MaintenancePlanFormValues,
): MaintenancePlanFormErrors {
  const result = maintenancePlanFormSchema.safeParse(values);
  if (result.success) return {};

  const errors: MaintenancePlanFormErrors = {};
  for (const issue of result.error.issues) {
    const field = issue.path[0];
    if (typeof field === 'string' && !(field in errors)) {
      errors[field as keyof MaintenancePlanFormValues] = issue.message;
    }
  }
  return errors;
}

export function hasMaintenancePlanFormChanges(
  a: MaintenancePlanFormValues,
  b: MaintenancePlanFormValues,
): boolean {
  return (Object.keys(a) as Array<keyof MaintenancePlanFormValues>).some(
    (key) => a[key] !== b[key],
  );
}
