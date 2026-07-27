import { z } from 'zod';
import { toDateInputValue } from './machine-form';
import type { MachinePart, MachinePartInput } from './types';

/** Categories offered in the form. Free text is still accepted for anything unlisted. */
export const partCategoryOptions = [
  'Bearings',
  'Seals',
  'Hydraulics',
  'Power transmission',
  'Rotating',
  'Electrical',
  'Instrumentation',
  'Combustion',
  'Wear parts',
  'Consumable',
  'Other',
] as const;

export const partUnitOptions = ['pcs', 'set', 'm', 'kg', 'l'] as const;

const requiredText = (label: string, min: number, max: number) =>
  z
    .string()
    .trim()
    .min(min, min === 1 ? `${label} is required.` : `${label} must be at least ${min} characters.`)
    .max(max, `${label} must be ${max} characters or fewer.`);

export const partFormSchema = z
  .object({
    machineId: z.string().min(1, 'Select the machine this component is fitted to.'),
    partCode: requiredText('Part code', 2, 20).regex(
      /^[A-Za-z0-9][A-Za-z0-9-/]*$/,
      'Use letters, digits, hyphens, and slashes only.',
    ),
    partName: requiredText('Part name', 3, 80),
    category: requiredText('Category', 2, 40),
    serialNumber: z
      .string()
      .trim()
      .max(60, 'Serial number must be 60 characters or fewer.')
      .optional(),
    quantity: z
      .number({ invalid_type_error: 'Quantity must be a number.' })
      .int('Quantity must be a whole number.')
      .min(1, 'At least one component must be fitted.')
      .max(9999, 'Quantity must be 9999 or fewer.'),
    unit: requiredText('Unit', 1, 10),
    positionOnMachine: requiredText('Position on machine', 2, 80),
    fittedDate: z
      .string()
      .min(1, 'Fitted date is required.')
      .refine((value) => !Number.isNaN(new Date(value).getTime()), 'Enter a valid fitted date.'),
    /** Empty means "no expected life recorded", which is valid. */
    expectedLifeMonths: z
      .number({ invalid_type_error: 'Expected life must be a number.' })
      .int('Expected life must be a whole number of months.')
      .min(1, 'Expected life must be at least one month.')
      .max(600, 'Expected life must be 600 months or fewer.')
      .optional(),
    notes: z.string().trim().max(1000, 'Notes must be 1000 characters or fewer.').optional(),
  })
  .superRefine((values, ctx) => {
    const fittedAt = new Date(values.fittedDate).getTime();
    if (!Number.isNaN(fittedAt) && fittedAt > Date.now()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['fittedDate'],
        message: 'Fitted date cannot be in the future.',
      });
    }
  });

export type PartFormValues = z.infer<typeof partFormSchema>;
export type PartFormErrors = Partial<Record<keyof PartFormValues, string>>;

export function emptyPartFormValues(machineId = ''): PartFormValues {
  return {
    machineId,
    partCode: '',
    partName: '',
    category: 'Bearings',
    serialNumber: '',
    quantity: 1,
    unit: 'pcs',
    positionOnMachine: '',
    fittedDate: toDateInputValue(new Date().toISOString()),
    expectedLifeMonths: undefined,
    notes: '',
  };
}

export function partToFormValues(part: MachinePart): PartFormValues {
  return {
    machineId: part.machineId,
    partCode: part.partCode,
    partName: part.partName,
    category: part.category,
    serialNumber: part.serialNumber ?? '',
    quantity: part.quantity,
    unit: part.unit,
    positionOnMachine: part.positionOnMachine,
    fittedDate: toDateInputValue(part.fittedDate),
    expectedLifeMonths: part.expectedLifeMonths,
    notes: part.notes,
  };
}

export function formValuesToPartInput(values: PartFormValues): MachinePartInput {
  return {
    machineId: values.machineId,
    partCode: values.partCode,
    partName: values.partName,
    category: values.category,
    serialNumber: values.serialNumber,
    quantity: values.quantity,
    unit: values.unit,
    positionOnMachine: values.positionOnMachine,
    fittedDate: values.fittedDate,
    expectedLifeMonths: values.expectedLifeMonths,
    notes: values.notes ?? '',
  };
}

export function validatePartForm(values: PartFormValues): PartFormErrors {
  const result = partFormSchema.safeParse(values);
  if (result.success) return {};

  const errors: PartFormErrors = {};
  for (const issue of result.error.issues) {
    const field = issue.path[0];
    if (typeof field === 'string' && !(field in errors)) {
      errors[field as keyof PartFormValues] = issue.message;
    }
  }
  return errors;
}

export function hasPartFormChanges(a: PartFormValues, b: PartFormValues): boolean {
  return (Object.keys(a) as Array<keyof PartFormValues>).some((key) => a[key] !== b[key]);
}

/** Replacement dialog validation, kept separate from the part form itself. */
export const partReplacementSchema = z.object({
  replacedOn: z
    .string()
    .min(1, 'Replacement date is required.')
    .refine((value) => !Number.isNaN(new Date(value).getTime()), 'Enter a valid date.')
    .refine((value) => new Date(value).getTime() <= Date.now(), 'Date cannot be in the future.'),
  reason: requiredText('Reason', 3, 200),
  newSerialNumber: z
    .string()
    .trim()
    .max(60, 'Serial number must be 60 characters or fewer.')
    .optional(),
  notes: z.string().trim().max(500, 'Notes must be 500 characters or fewer.').optional(),
});

export type PartReplacementValues = z.infer<typeof partReplacementSchema>;
