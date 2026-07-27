import { useMemo, useState } from 'react';
import { Link, useLocation, useSearch } from 'wouter';
import { ArrowLeft } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { FeedbackMessage } from '@/components/shared/FeedbackMessage';
import { EmptyState } from '@/components/shared/EmptyState';
import { Button } from '@/components/ui/button';
import {
  MaintenanceRecordForm,
  type MaintenanceRecordFormSubmitResult,
} from '@/components/maintenance/MaintenanceRecordForm';
import { useAuth } from '@/lib/mock-auth';
import { can } from '@/lib/permissions';
import { useDepartment } from '@/hooks/use-department';
import { useMockRepository } from '@/hooks/use-mock-repository';
import { mockRepository } from '@/lib/mock-repository';
import {
  emptyMaintenanceRecordFormValues,
  formValuesToMaintenanceRecordInput,
  type MaintenanceRecordFormValues,
} from '@/lib/maintenance-form';
import { maintenanceDetailPath, registeredRoutes } from '@/lib/routes';
import UnauthorizedPage from '@/pages/UnauthorizedPage';

export default function MaintenanceAddPage() {
  const { user } = useAuth();
  const { current, scope } = useDepartment();
  const repository = useMockRepository();
  const [, setLocation] = useLocation();
  const searchString = useSearch();

  const presetMachineId = useMemo(
    () => new URLSearchParams(searchString).get('machine') ?? '',
    [searchString],
  );
  const presetPlanId = useMemo(
    () => new URLSearchParams(searchString).get('plan') ?? undefined,
    [searchString],
  );
  const [initialValues] = useState<MaintenanceRecordFormValues>(() =>
    emptyMaintenanceRecordFormValues(presetMachineId, presetPlanId),
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
    values: MaintenanceRecordFormValues,
  ): Promise<MaintenanceRecordFormSubmitResult> => {
    const result = mockRepository.createMaintenanceRecord(
      formValuesToMaintenanceRecordInput(values),
      user?.id ?? 'unknown',
    );

    if (!result.ok) {
      return {
        ok: false,
        message: result.message,
        field: result.reason === 'unknown_machine' ? 'machineId' : undefined,
      };
    }

    setLocation(maintenanceDetailPath(result.data.id));
    return { ok: true };
  };

  return (
    <div className="max-w-5xl space-y-6">
      <Link href={registeredRoutes.maintenance}>
        <Button variant="ghost" size="sm">
          <ArrowLeft size={16} className="mr-2" aria-hidden="true" /> Back to maintenance
        </Button>
      </Link>

      <PageHeader
        title="Log maintenance"
        description="Schedule or log a maintenance record for a machine in this department."
      />

      <FeedbackMessage
        feedback={{
          state: 'validation',
          title: 'Preview mode — data is not persisted',
          description:
            'This record is saved to the in-memory preview store and resets on page reload.',
        }}
      />

      {machines.length === 0 ? (
        <EmptyState
          title="No machines available"
          description="This department has no active machines to log maintenance against."
        />
      ) : (
        <MaintenanceRecordForm
          mode="create"
          initialValues={initialValues}
          machines={machines}
          technicians={technicians}
          onSubmit={handleSubmit}
          onCancel={() => setLocation(registeredRoutes.maintenance)}
        />
      )}
    </div>
  );
}
