import { z } from 'zod';
import type { Machine, MachineInput, MachineStatus, MachineType } from './types';

export const machineTypeOptions: readonly MachineType[] = [
  'motor',
  'pump',
  'compressor',
  'crane',
  'conveyor',
  'press',
  'mill',
  'blower',
  'lathe',
  'other',
];

/**
 * `retired` is deliberately absent: retirement happens through the audited archive
 * workflow so the form cannot produce a machine that is retired but not archived.
 */
export const machineFormStatusOptions = [
  'active',
  'inactive',
  'under_maintenance',
  'under_repair',
] as const satisfies readonly MachineStatus[];

const requiredText = (label: string, min: number, max: number) =>
  z
    .string()
    .trim()
    .min(min, min === 1 ? `${label} is required.` : `${label} must be at least ${min} characters.`)
    .max(max, `${label} must be ${max} characters or fewer.`);

const optionalText = (label: string, max: number) =>
  z.string().trim().max(max, `${label} must be ${max} characters or fewer.`).optional();

const isoDate = (label: string) =>
  z
    .string()
    .min(1, `${label} is required.`)
    .refine((value) => !Number.isNaN(new Date(value).getTime()), `Enter a valid ${label}.`);

export const machineFormSchema = z
  .object({
    code: requiredText('Machine code', 2, 20).regex(
      /^[A-Za-z0-9][A-Za-z0-9-/]*$/,
      'Use letters, digits, hyphens, and slashes only.',
    ),
    name: requiredText('Machine name', 3, 80),
    departmentId: z.string().min(1, 'Select a department.'),
    type: z.enum([
      'motor',
      'pump',
      'compressor',
      'crane',
      'conveyor',
      'press',
      'mill',
      'blower',
      'lathe',
      'other',
    ]),
    manufacturer: requiredText('Manufacturer', 2, 60),
    model: requiredText('Model', 1, 60),
    serialNumber: optionalText('Serial number', 60),
    capacity: optionalText('Capacity', 40),
    powerRating: optionalText('Power rating', 40),
    voltage: optionalText('Voltage', 40),
    weight: optionalText('Weight', 40),
    installationDate: isoDate('installation date'),
    nextMaintenanceDate: isoDate('next maintenance date'),
    location: requiredText('Location', 2, 80),
    plantArea: optionalText('Plant area', 60),
    baySection: optionalText('Bay or section', 60),
    floor: optionalText('Floor', 40),
    roomPosition: optionalText('Room or position', 60),
    status: z.enum(['active', 'inactive', 'under_maintenance', 'under_repair']),
    description: optionalText('Description', 1000),
  })
  .superRefine((values, ctx) => {
    const installedAt = new Date(values.installationDate).getTime();
    const nextDueAt = new Date(values.nextMaintenanceDate).getTime();

    if (!Number.isNaN(installedAt) && installedAt > Date.now()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['installationDate'],
        message: 'Installation date cannot be in the future.',
      });
    }

    if (!Number.isNaN(installedAt) && !Number.isNaN(nextDueAt) && nextDueAt < installedAt) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['nextMaintenanceDate'],
        message: 'Next maintenance cannot be scheduled before installation.',
      });
    }
  });

export type MachineFormValues = z.infer<typeof machineFormSchema>;

export type EditableMachineStatus = MachineFormValues['status'];

function isEditableStatus(status: MachineStatus): status is EditableMachineStatus {
  return (machineFormStatusOptions as readonly MachineStatus[]).includes(status);
}

/** Field-keyed validation messages, matching how the form renders inline errors. */
export type MachineFormErrors = Partial<Record<keyof MachineFormValues, string>>;

export function emptyMachineFormValues(): MachineFormValues {
  return {
    code: '',
    name: '',
    departmentId: '',
    type: 'motor',
    manufacturer: '',
    model: '',
    serialNumber: '',
    capacity: '',
    powerRating: '',
    voltage: '',
    weight: '',
    installationDate: toDateInputValue(new Date().toISOString()),
    nextMaintenanceDate: '',
    location: '',
    plantArea: '',
    baySection: '',
    floor: '',
    roomPosition: '',
    status: 'active',
    description: '',
  };
}

export function machineToFormValues(machine: Machine): MachineFormValues {
  return {
    code: machine.code,
    name: machine.name,
    departmentId: machine.departmentId,
    type: machine.type,
    manufacturer: machine.manufacturer,
    model: machine.model,
    serialNumber: machine.serialNumber ?? '',
    capacity: machine.capacity ?? '',
    powerRating: machine.powerRating ?? '',
    voltage: machine.voltage ?? '',
    weight: machine.weight ?? '',
    installationDate: toDateInputValue(machine.installationDate),
    nextMaintenanceDate: toDateInputValue(machine.nextMaintenanceDate),
    location: machine.location,
    plantArea: machine.plantArea ?? '',
    baySection: machine.baySection ?? '',
    floor: machine.floor ?? '',
    roomPosition: machine.roomPosition ?? '',
    // An archived machine is read-only, so its `retired` status never reaches the form.
    status: isEditableStatus(machine.status) ? machine.status : 'inactive',
    description: machine.description,
  };
}

export function formValuesToMachineInput(values: MachineFormValues): MachineInput {
  return {
    code: values.code,
    name: values.name,
    departmentId: values.departmentId,
    type: values.type,
    manufacturer: values.manufacturer,
    model: values.model,
    serialNumber: values.serialNumber,
    capacity: values.capacity,
    powerRating: values.powerRating,
    voltage: values.voltage,
    weight: values.weight,
    installationDate: values.installationDate,
    nextMaintenanceDate: values.nextMaintenanceDate,
    location: values.location,
    plantArea: values.plantArea,
    baySection: values.baySection,
    floor: values.floor,
    roomPosition: values.roomPosition,
    status: values.status,
    description: values.description ?? '',
  };
}

/** Normalizes fixture dates, which mix `YYYY-MM-DD` and full ISO strings. */
export function toDateInputValue(value: string): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

export function validateMachineForm(values: MachineFormValues): MachineFormErrors {
  const result = machineFormSchema.safeParse(values);
  if (result.success) return {};

  const errors: MachineFormErrors = {};
  for (const issue of result.error.issues) {
    const field = issue.path[0];
    if (typeof field === 'string' && !(field in errors)) {
      errors[field as keyof MachineFormValues] = issue.message;
    }
  }
  return errors;
}

export function hasFormChanges(a: MachineFormValues, b: MachineFormValues): boolean {
  return (Object.keys(a) as Array<keyof MachineFormValues>).some((key) => a[key] !== b[key]);
}
