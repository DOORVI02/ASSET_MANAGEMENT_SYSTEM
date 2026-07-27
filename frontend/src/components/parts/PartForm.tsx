import { useCallback, useMemo, useState, type FormEvent } from 'react';
import { Loader2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PageSection } from '@/components/shared/PageSection';
import { FeedbackMessage } from '@/components/shared/FeedbackMessage';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { MachineFormField } from '@/components/machines/MachineFormField';
import { fieldAria } from '@/lib/form-aria';
import {
  hasPartFormChanges,
  partCategoryOptions,
  partUnitOptions,
  validatePartForm,
  type PartFormErrors,
  type PartFormValues,
} from '@/lib/part-form';
import type { Machine } from '@/lib/types';

export type PartFormSubmitResult =
  { ok: true } | { ok: false; message: string; field?: keyof PartFormValues };

interface PartFormProps {
  mode: 'create' | 'edit';
  initialValues: PartFormValues;
  /** Machines the user may fit parts to, already department-scoped. */
  machines: Machine[];
  /** Case-insensitive serial uniqueness check across all parts, excluding this one. */
  isSerialTaken: (serialNumber: string) => boolean;
  onSubmit: (values: PartFormValues) => Promise<PartFormSubmitResult>;
  onCancel: () => void;
}

export function PartForm({
  mode,
  initialValues,
  machines,
  isSerialTaken,
  onSubmit,
  onCancel,
}: PartFormProps) {
  const [values, setValues] = useState<PartFormValues>(initialValues);
  const [errors, setErrors] = useState<PartFormErrors>({});
  const [touched, setTouched] = useState<Partial<Record<keyof PartFormValues, boolean>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);

  const isDirty = useMemo(() => hasPartFormChanges(values, initialValues), [values, initialValues]);
  const validationErrors = useMemo(() => validatePartForm(values), [values]);

  const duplicateSerial = useMemo(() => {
    const trimmed = (values.serialNumber ?? '').trim();
    return trimmed.length > 0 && isSerialTaken(trimmed);
  }, [values.serialNumber, isSerialTaken]);

  const setField = useCallback(
    <K extends keyof PartFormValues>(field: K, value: PartFormValues[K]) => {
      setValues((previous) => ({ ...previous, [field]: value }));
      setSubmitError(null);
    },
    [],
  );

  const markTouched = useCallback((field: keyof PartFormValues) => {
    setTouched((previous) => ({ ...previous, [field]: true }));
  }, []);

  const errorFor = (field: keyof PartFormValues): string | undefined => {
    if (
      field === 'serialNumber' &&
      duplicateSerial &&
      (touched.serialNumber || hasAttemptedSubmit)
    ) {
      return 'Another part already uses this serial number.';
    }
    if (!touched[field] && !hasAttemptedSubmit) return undefined;
    return validationErrors[field];
  };

  const combinedError = (field: keyof PartFormValues): string | undefined =>
    errorFor(field) ?? errors[field];

  const invalidCount = Object.keys(validationErrors).length + (duplicateSerial ? 1 : 0);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setHasAttemptedSubmit(true);
    setSubmitError(null);

    const nextErrors = validatePartForm(values);
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0 || duplicateSerial) {
      const firstInvalid = duplicateSerial ? 'serialNumber' : Object.keys(nextErrors)[0];
      document.getElementById(`part-${firstInvalid}`)?.focus();
      return;
    }

    setIsSubmitting(true);
    const result = await onSubmit(values);
    setIsSubmitting(false);

    if (!result.ok) {
      setSubmitError(result.message);
      if (result.field) {
        setErrors((previous) => ({ ...previous, [result.field as string]: result.message }));
        document.getElementById(`part-${result.field}`)?.focus();
      }
    }
  };

  const cancelButton =
    isDirty && !isSubmitting ? (
      <ConfirmDialog
        trigger={
          <Button type="button" variant="outline">
            Cancel
          </Button>
        }
        title="Discard unsaved changes?"
        description="This part has unsaved edits. Leaving now discards them."
        confirmText="Discard changes"
        cancelText="Keep editing"
        onConfirm={onCancel}
        variant="destructive"
      />
    ) : (
      <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
        Cancel
      </Button>
    );

  return (
    <form onSubmit={handleSubmit} className="space-y-6" noValidate>
      {submitError ? (
        <FeedbackMessage
          feedback={{
            state: 'validation',
            title: mode === 'create' ? 'Part not fitted' : 'Changes not saved',
            description: submitError,
          }}
        />
      ) : null}

      {hasAttemptedSubmit && invalidCount > 0 ? (
        <FeedbackMessage
          feedback={{
            state: 'validation',
            title: `${invalidCount} field${invalidCount === 1 ? '' : 's'} need attention`,
            description: 'Correct the highlighted fields below, then save again.',
          }}
        />
      ) : null}

      <PageSection
        title="Component identity"
        description="What the component is and which machine it is fitted to."
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <MachineFormField
            id="part-machineId"
            label="Machine"
            required
            error={combinedError('machineId')}
            className="sm:col-span-2"
          >
            <Select
              value={values.machineId}
              onValueChange={(value) => {
                setField('machineId', value);
                markTouched('machineId');
              }}
              disabled={isSubmitting}
            >
              <SelectTrigger {...fieldAria('part-machineId', combinedError('machineId'))}>
                <SelectValue placeholder="Select a machine" />
              </SelectTrigger>
              <SelectContent>
                {machines.map((machine) => (
                  <SelectItem key={machine.id} value={machine.id}>
                    {machine.code} — {machine.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </MachineFormField>

          <MachineFormField
            id="part-partCode"
            label="Part code"
            required
            error={combinedError('partCode')}
          >
            <Input
              {...fieldAria('part-partCode', combinedError('partCode'))}
              value={values.partCode}
              onChange={(event) => setField('partCode', event.target.value.toUpperCase())}
              onBlur={() => markTouched('partCode')}
              disabled={isSubmitting}
              autoComplete="off"
            />
          </MachineFormField>

          <MachineFormField
            id="part-partName"
            label="Part name"
            required
            error={combinedError('partName')}
          >
            <Input
              {...fieldAria('part-partName', combinedError('partName'))}
              value={values.partName}
              onChange={(event) => setField('partName', event.target.value)}
              onBlur={() => markTouched('partName')}
              disabled={isSubmitting}
            />
          </MachineFormField>

          <MachineFormField
            id="part-category"
            label="Category"
            required
            error={combinedError('category')}
          >
            <Select
              value={values.category}
              onValueChange={(value) => {
                setField('category', value);
                markTouched('category');
              }}
              disabled={isSubmitting}
            >
              <SelectTrigger {...fieldAria('part-category', combinedError('category'))}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {partCategoryOptions.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </MachineFormField>

          <MachineFormField
            id="part-serialNumber"
            label="Serial number"
            hint="Must be unique across all parts."
            error={combinedError('serialNumber')}
          >
            <Input
              {...fieldAria(
                'part-serialNumber',
                combinedError('serialNumber'),
                'Must be unique across all parts.',
              )}
              value={values.serialNumber ?? ''}
              onChange={(event) => setField('serialNumber', event.target.value)}
              onBlur={() => markTouched('serialNumber')}
              disabled={isSubmitting}
              autoComplete="off"
            />
          </MachineFormField>
        </div>
      </PageSection>

      <PageSection
        title="Fitment"
        description="Where the component sits, how many are fitted, and its service life."
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MachineFormField
            id="part-quantity"
            label="Quantity installed"
            required
            error={combinedError('quantity')}
          >
            <Input
              {...fieldAria('part-quantity', combinedError('quantity'))}
              type="number"
              min={1}
              value={Number.isNaN(values.quantity) ? '' : values.quantity}
              onChange={(event) => setField('quantity', event.target.valueAsNumber)}
              onBlur={() => markTouched('quantity')}
              disabled={isSubmitting}
            />
          </MachineFormField>

          <MachineFormField id="part-unit" label="Unit" required error={combinedError('unit')}>
            <Select
              value={values.unit}
              onValueChange={(value) => {
                setField('unit', value);
                markTouched('unit');
              }}
              disabled={isSubmitting}
            >
              <SelectTrigger {...fieldAria('part-unit', combinedError('unit'))}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {partUnitOptions.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </MachineFormField>

          <MachineFormField
            id="part-fittedDate"
            label="Fitted date"
            required
            error={combinedError('fittedDate')}
          >
            <Input
              {...fieldAria('part-fittedDate', combinedError('fittedDate'))}
              type="date"
              value={values.fittedDate}
              onChange={(event) => setField('fittedDate', event.target.value)}
              onBlur={() => markTouched('fittedDate')}
              disabled={isSubmitting}
            />
          </MachineFormField>

          <MachineFormField
            id="part-expectedLifeMonths"
            label="Expected life (months)"
            hint="Leave blank if no service life is defined."
            error={combinedError('expectedLifeMonths')}
          >
            <Input
              {...fieldAria(
                'part-expectedLifeMonths',
                combinedError('expectedLifeMonths'),
                'Leave blank if no service life is defined.',
              )}
              type="number"
              min={1}
              value={values.expectedLifeMonths ?? ''}
              onChange={(event) =>
                setField(
                  'expectedLifeMonths',
                  event.target.value === '' ? undefined : event.target.valueAsNumber,
                )
              }
              onBlur={() => markTouched('expectedLifeMonths')}
              disabled={isSubmitting}
            />
          </MachineFormField>

          <MachineFormField
            id="part-positionOnMachine"
            label="Position on machine"
            required
            hint="For example: drive end bearing housing."
            error={combinedError('positionOnMachine')}
            className="sm:col-span-2 lg:col-span-4"
          >
            <Input
              {...fieldAria(
                'part-positionOnMachine',
                combinedError('positionOnMachine'),
                'For example: drive end bearing housing.',
              )}
              value={values.positionOnMachine}
              onChange={(event) => setField('positionOnMachine', event.target.value)}
              onBlur={() => markTouched('positionOnMachine')}
              disabled={isSubmitting}
            />
          </MachineFormField>

          <MachineFormField
            id="part-notes"
            label="Notes"
            error={combinedError('notes')}
            className="sm:col-span-2 lg:col-span-4"
          >
            <Textarea
              {...fieldAria('part-notes', combinedError('notes'))}
              rows={3}
              value={values.notes ?? ''}
              onChange={(event) => setField('notes', event.target.value)}
              onBlur={() => markTouched('notes')}
              disabled={isSubmitting}
            />
          </MachineFormField>
        </div>
      </PageSection>

      <div className="flex flex-col-reverse gap-3 border-t pt-6 sm:flex-row sm:items-center sm:justify-end">
        <p className="text-xs text-muted-foreground sm:mr-auto" role="status">
          {isDirty ? 'Unsaved changes' : 'No unsaved changes'}
        </p>
        {cancelButton}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
              {mode === 'create' ? 'Fitting…' : 'Saving…'}
            </>
          ) : (
            <>
              <Save size={16} className="mr-2" aria-hidden="true" />
              {mode === 'create' ? 'Fit part' : 'Save changes'}
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
