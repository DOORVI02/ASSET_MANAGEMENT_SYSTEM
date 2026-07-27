import { useMemo, useState } from 'react';
import { Link, useLocation, useSearch } from 'wouter';
import { ArrowLeft } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { FeedbackMessage } from '@/components/shared/FeedbackMessage';
import { EmptyState } from '@/components/shared/EmptyState';
import { Button } from '@/components/ui/button';
import {
  MaintenancePlanForm,
  type MaintenancePlanFormSubmitResult,
} from '@/components/maintenance/MaintenancePlanForm';
import { useAuth } from '@/lib/mock-auth';
import { can } from '@/lib/permissions';
import { useDepartment } from '@/hooks/use-department';
import { useMockRepository } from '@/hooks/use-mock-repository';
import { mockRepository } from '@/lib/mock-repository';
import {
  emptyMaintenancePlanFormValues,
  formValuesToMaintenancePlanInput,
  type MaintenancePlanFormValues,
} from '@/lib/maintenance-form';
import { maintenancePath } from '@/lib/routes';
import UnauthorizedPage from '@/pages/UnauthorizedPage';

export default function MaintenancePlanAddPage() {
  const { user } = useAuth();
  const { current, scope } = useDepartment();
  const repository = useMockRepository();
  const [, setLocation] = useLocation();
  const searchString = useSearch();

  const presetMachineId = useMemo(
    () => new URLSearchParams(searchString).get('machine') ?? '',
    [searchString],
  );
  const [initialValues] = useState<MaintenancePlanFormValues>(() =>
    emptyMaintenancePlanFormValues(presetMachineId),
  );

  const machines = useMemo(
    () =>
      current
        ? repository.listMachinesForDepartment(current.id, scope).filter((m) => !m.isArchived)
        : [],
    [current, repository, scope],
  );
  const technicians = useMemo(() => repository.listTechnicians(), [repository]);

  if (!can(user, 'maintenance:add')) {
    return <UnauthorizedPage />;
  }

  const handleSubmit = async (
    values: MaintenancePlanFormValues,
  ): Promise<MaintenancePlanFormSubmitResult> => {
    const result = mockRepository.createMaintenancePlan(
      formValuesToMaintenancePlanInput(values),
      user?.id ?? 'unknown',
    );

    if (!result.ok) {
      return {
        ok: false,
        message: result.message,
        field: result.reason === 'unknown_machine' ? 'machineId' : undefined,
      };
    }

    setLocation(maintenancePath({ view: 'plans' }));
    return { ok: true };
  };

  return (
    // Matches every other add/edit page's width. `MaintenancePlanForm` uses the same
    // `sm:grid-cols-2` layout as `MaintenanceRecordForm`, so there was no structural
    // reason for this page alone to be narrower.
    <div className="max-w-5xl space-y-6">
      <Link href={maintenancePath({ view: 'plans' })}>
        <Button variant="ghost" size="sm">
          <ArrowLeft size={16} className="mr-2" aria-hidden="true" /> Back to plans
        </Button>
      </Link>

      <PageHeader
        title="New recurring plan"
        description="Define a maintenance plan that repeats on a fixed interval."
      />

      <FeedbackMessage
        feedback={{
          state: 'validation',
          title: 'Preview mode — data is not persisted',
          description:
            'This plan is saved to the in-memory preview store and resets on page reload.',
        }}
      />

      {machines.length === 0 ? (
        <EmptyState
          title="No machines available"
          description="This department has no active machines to define a plan for."
        />
      ) : (
        <MaintenancePlanForm
          mode="create"
          initialValues={initialValues}
          machines={machines}
          technicians={technicians}
          onSubmit={handleSubmit}
          onCancel={() => setLocation(maintenancePath({ view: 'plans' }))}
        />
      )}
    </div>
  );
}
