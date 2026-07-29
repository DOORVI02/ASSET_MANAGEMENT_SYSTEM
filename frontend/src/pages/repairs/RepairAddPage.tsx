import { useMemo, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Link, useLocation, useSearch } from 'wouter';
import {
  RepairRecordForm,
  type RepairRecordFormSubmitResult,
} from '@/components/repairs/RepairRecordForm';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/shared/EmptyState';
import { FeedbackMessage } from '@/components/shared/FeedbackMessage';
import { PageHeader } from '@/components/shared/PageHeader';
import { useAuth } from '@/hooks/use-auth';
import { mockRepository } from '@/lib/mock-repository';
import { can } from '@/lib/permissions';
import {
  emptyRepairRecordFormValues,
  formValuesToRepairRecordInput,
  type RepairRecordFormValues,
} from '@/lib/repair-form';
import { registeredRoutes, repairDetailPath } from '@/lib/routes';
import { useDepartment } from '@/hooks/use-department';
import { useMockRepository } from '@/hooks/use-mock-repository';
import UnauthorizedPage from '@/pages/UnauthorizedPage';

export default function RepairAddPage() {
  const { user } = useAuth();
  const { current, scope } = useDepartment();
  const repository = useMockRepository();
  const [, setLocation] = useLocation();
  const search = useSearch();
  const machineId = useMemo(() => new URLSearchParams(search).get('machine') ?? '', [search]);
  const [initialValues] = useState(() => emptyRepairRecordFormValues(machineId));
  const machines = useMemo(
    () =>
      current
        ? repository
            .listMachinesForDepartment(current.id, scope)
            .filter((machine) => !machine.isArchived)
        : [],
    [current, repository, scope],
  );

  if (!can(user, 'repair:add')) return <UnauthorizedPage />;
  const submit = async (values: RepairRecordFormValues): Promise<RepairRecordFormSubmitResult> => {
    const result = mockRepository.createRepairRecord(
      formValuesToRepairRecordInput(values),
      user?.id ?? 'unknown',
    );
    if (!result.ok)
      return {
        ok: false,
        message: result.message,
        field: result.reason === 'unknown_machine' ? 'machineId' : undefined,
      };
    setLocation(repairDetailPath(result.data.id));
    return { ok: true };
  };

  return (
    <div className="max-w-5xl space-y-6">
      <Link href={registeredRoutes.repairs}>
        <Button variant="ghost" size="sm">
          <ArrowLeft size={16} className="mr-2" aria-hidden="true" />
          Back to repairs
        </Button>
      </Link>
      <PageHeader
        title="Report repair"
        description="Log a fault against a machine in the current department."
      />
      <FeedbackMessage
        feedback={{
          state: 'validation',
          title: 'Preview mode — data is not persisted',
          description:
            'This repair is saved to the in-memory preview store and resets on page reload.',
        }}
      />
      {machines.length ? (
        <RepairRecordForm
          mode="create"
          initialValues={initialValues}
          machines={machines}
          onSubmit={submit}
          onCancel={() => setLocation(registeredRoutes.repairs)}
        />
      ) : (
        <EmptyState
          title="No machines available"
          description="This department has no active machines to report a repair against."
        />
      )}
    </div>
  );
}
