import { z } from 'zod';
import type { RepairRecord, RepairRecordInput } from './types';

const requiredText = (label: string, min: number, max: number) =>
  z
    .string()
    .trim()
    .min(min, `${label} must be at least ${min} characters.`)
    .max(max, `${label} must be ${max} characters or fewer.`);

export const repairRecordFormSchema = z.object({
  machineId: z.string().min(1, 'Select the machine this repair applies to.'),
  reportedDate: z.string().min(1, 'Reported date is required.'),
  reportedBy: requiredText('Reporter', 2, 80),
  assignedTo: z.string().trim().max(80, 'Assignee must be 80 characters or fewer.').optional(),
  description: requiredText('Problem description', 3, 1000),
  diagnosis: z.string().trim().max(1000, 'Diagnosis must be 1000 characters or fewer.').optional(),
  resolution: z
    .string()
    .trim()
    .max(1000, 'Resolution must be 1000 characters or fewer.')
    .optional(),
  partsUsed: z.string().trim().max(300, 'Parts used must be 300 characters or fewer.').optional(),
  downtimeHours: z.number().min(0, 'Downtime cannot be negative.').max(9999).optional(),
  remarks: z.string().trim().max(500, 'Remarks must be 500 characters or fewer.').optional(),
});

export type RepairRecordFormValues = z.infer<typeof repairRecordFormSchema>;
export type RepairRecordFormErrors = Partial<Record<keyof RepairRecordFormValues, string>>;

function dateInput(value: string): string {
  return value.slice(0, 10);
}

export function emptyRepairRecordFormValues(machineId = ''): RepairRecordFormValues {
  return {
    machineId,
    reportedDate: dateInput(new Date().toISOString()),
    reportedBy: '',
    assignedTo: '',
    description: '',
    diagnosis: '',
    resolution: '',
    partsUsed: '',
    downtimeHours: undefined,
    remarks: '',
  };
}

export function repairRecordToFormValues(record: RepairRecord): RepairRecordFormValues {
  return {
    machineId: record.machineId,
    reportedDate: dateInput(record.reportedDate),
    reportedBy: record.reportedBy,
    assignedTo: record.assignedTo ?? '',
    description: record.description,
    diagnosis: record.diagnosis ?? '',
    resolution: record.resolution ?? '',
    partsUsed: record.partsUsed ?? '',
    downtimeHours: record.downtimeHours,
    remarks: record.remarks ?? '',
  };
}

export function formValuesToRepairRecordInput(values: RepairRecordFormValues): RepairRecordInput {
  return values;
}

export function validateRepairRecordForm(values: RepairRecordFormValues): RepairRecordFormErrors {
  const result = repairRecordFormSchema.safeParse(values);
  if (result.success) return {};
  const errors: RepairRecordFormErrors = {};
  for (const issue of result.error.issues) {
    const field = issue.path[0];
    if (typeof field === 'string' && !errors[field as keyof RepairRecordFormValues]) {
      errors[field as keyof RepairRecordFormValues] = issue.message;
    }
  }
  return errors;
}

export function hasRepairRecordFormChanges(
  a: RepairRecordFormValues,
  b: RepairRecordFormValues,
): boolean {
  return (Object.keys(a) as Array<keyof RepairRecordFormValues>).some((key) => a[key] !== b[key]);
}

export const repairCompletionSchema = z.object({
  diagnosis: requiredText('Diagnosis', 3, 1000),
  resolution: requiredText('Resolution', 3, 1000),
  downtimeHours: z.number().min(0, 'Downtime cannot be negative.').max(9999).optional(),
});
export type RepairCompletionValues = z.infer<typeof repairCompletionSchema>;

export const repairCancellationSchema = z.object({
  reason: requiredText('Cancellation reason', 3, 300),
});
export type RepairCancellationValues = z.infer<typeof repairCancellationSchema>;
