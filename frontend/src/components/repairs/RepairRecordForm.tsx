import { useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Save } from 'lucide-react';
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
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { FeedbackMessage } from '@/components/shared/FeedbackMessage';
import { PageSection } from '@/components/shared/PageSection';
import { MachineFormField } from '@/components/machines/MachineFormField';
import { fieldAria } from '@/lib/form-aria';
import {
  hasRepairRecordFormChanges,
  validateRepairRecordForm,
  type RepairRecordFormErrors,
  type RepairRecordFormValues,
} from '@/lib/repair-form';
import type { Machine } from '@/lib/types';

export type RepairRecordFormSubmitResult =
  { ok: true } | { ok: false; message: string; field?: keyof RepairRecordFormValues };

interface RepairRecordFormProps {
  mode: 'create' | 'edit';
  initialValues: RepairRecordFormValues;
  machines: Machine[];
  onSubmit: (values: RepairRecordFormValues) => Promise<RepairRecordFormSubmitResult>;
  onCancel: () => void;
}

export function RepairRecordForm({
  mode,
  initialValues,
  machines,
  onSubmit,
  onCancel,
}: RepairRecordFormProps) {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState<RepairRecordFormErrors>({});
  const [attempted, setAttempted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const validationErrors = useMemo(() => validateRepairRecordForm(values), [values]);
  const dirty = useMemo(
    () => hasRepairRecordFormChanges(values, initialValues),
    [initialValues, values],
  );

  const setField = <K extends keyof RepairRecordFormValues>(
    field: K,
    value: RepairRecordFormValues[K],
  ) => {
    setValues((current) => ({ ...current, [field]: value }));
    setSubmitError(null);
  };
  const errorFor = (field: keyof RepairRecordFormValues) =>
    attempted ? (validationErrors[field] ?? errors[field]) : errors[field];

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setAttempted(true);
    const nextErrors = validateRepairRecordForm(values);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      document.getElementById(`repair-${Object.keys(nextErrors)[0]}`)?.focus();
      return;
    }
    setSubmitting(true);
    const result = await onSubmit(values);
    setSubmitting(false);
    if (!result.ok) {
      setSubmitError(result.message);
      if (result.field) setErrors((current) => ({ ...current, [result.field!]: result.message }));
    }
  };

  const field = (
    id: string,
    label: string,
    key: keyof RepairRecordFormValues,
    child: ReactNode,
  ) => (
    <MachineFormField id={id} label={label} error={errorFor(key)}>
      {child}
    </MachineFormField>
  );

  return (
    <form className="space-y-6" noValidate onSubmit={submit}>
      {submitError ? (
        <FeedbackMessage
          feedback={{ state: 'validation', title: 'Repair not saved', description: submitError }}
        />
      ) : null}
      {attempted && Object.keys(validationErrors).length ? (
        <FeedbackMessage
          feedback={{
            state: 'validation',
            title: 'Some fields need attention',
            description: 'Correct the highlighted fields, then save again.',
          }}
        />
      ) : null}
      <PageSection
        title="Report"
        description="Identify the machine, report date, reporter, and fault."
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <MachineFormField
            id="repair-machineId"
            label="Machine"
            required
            error={errorFor('machineId')}
          >
            <Select
              value={values.machineId}
              onValueChange={(value) => setField('machineId', value)}
              disabled={submitting}
            >
              <SelectTrigger {...fieldAria('repair-machineId', errorFor('machineId'))}>
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
          {field(
            'repair-reportedDate',
            'Reported date',
            'reportedDate',
            <Input
              {...fieldAria('repair-reportedDate', errorFor('reportedDate'))}
              type="date"
              value={values.reportedDate}
              onChange={(event) => setField('reportedDate', event.target.value)}
              disabled={submitting}
            />,
          )}
          {field(
            'repair-reportedBy',
            'Reported by',
            'reportedBy',
            <Input
              {...fieldAria('repair-reportedBy', errorFor('reportedBy'))}
              value={values.reportedBy}
              onChange={(event) => setField('reportedBy', event.target.value)}
              disabled={submitting}
            />,
          )}
          {field(
            'repair-assignedTo',
            'Assigned to',
            'assignedTo',
            <Input
              {...fieldAria('repair-assignedTo', errorFor('assignedTo'))}
              value={values.assignedTo ?? ''}
              onChange={(event) => setField('assignedTo', event.target.value)}
              disabled={submitting}
            />,
          )}
          <MachineFormField
            id="repair-description"
            label="Problem description"
            required
            error={errorFor('description')}
            className="sm:col-span-2"
          >
            <Textarea
              {...fieldAria('repair-description', errorFor('description'))}
              rows={4}
              value={values.description}
              onChange={(event) => setField('description', event.target.value)}
              disabled={submitting}
            />
          </MachineFormField>
        </div>
      </PageSection>
      <PageSection
        title="Diagnosis and work"
        description="Add detail as the investigation and repair proceeds."
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {field(
            'repair-diagnosis',
            'Diagnosis',
            'diagnosis',
            <Textarea
              {...fieldAria('repair-diagnosis', errorFor('diagnosis'))}
              rows={4}
              value={values.diagnosis ?? ''}
              onChange={(event) => setField('diagnosis', event.target.value)}
              disabled={submitting}
            />,
          )}
          {field(
            'repair-resolution',
            'Action / resolution',
            'resolution',
            <Textarea
              {...fieldAria('repair-resolution', errorFor('resolution'))}
              rows={4}
              value={values.resolution ?? ''}
              onChange={(event) => setField('resolution', event.target.value)}
              disabled={submitting}
            />,
          )}
          {field(
            'repair-partsUsed',
            'Parts used',
            'partsUsed',
            <Input
              {...fieldAria('repair-partsUsed', errorFor('partsUsed'))}
              value={values.partsUsed ?? ''}
              onChange={(event) => setField('partsUsed', event.target.value)}
              disabled={submitting}
            />,
          )}
          {field(
            'repair-downtimeHours',
            'Downtime (hours)',
            'downtimeHours',
            <Input
              {...fieldAria('repair-downtimeHours', errorFor('downtimeHours'))}
              type="number"
              min={0}
              step="0.5"
              value={values.downtimeHours ?? ''}
              onChange={(event) =>
                setField(
                  'downtimeHours',
                  event.target.value === '' ? undefined : event.target.valueAsNumber,
                )
              }
              disabled={submitting}
            />,
          )}
          {field(
            'repair-remarks',
            'Remarks',
            'remarks',
            <Textarea
              {...fieldAria('repair-remarks', errorFor('remarks'))}
              rows={3}
              value={values.remarks ?? ''}
              onChange={(event) => setField('remarks', event.target.value)}
              disabled={submitting}
            />,
          )}
        </div>
      </PageSection>
      <div className="flex justify-end gap-3">
        {dirty && !submitting ? (
          <ConfirmDialog
            trigger={
              <Button type="button" variant="outline">
                Cancel
              </Button>
            }
            title="Discard unsaved changes?"
            description="Your repair edits will be lost."
            confirmText="Discard changes"
            onConfirm={onCancel}
            variant="destructive"
          />
        ) : (
          <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={submitting}>
          <Save size={16} className="mr-2" aria-hidden="true" />
          {mode === 'create' ? 'Report repair' : 'Save changes'}
        </Button>
      </div>
    </form>
  );
}
