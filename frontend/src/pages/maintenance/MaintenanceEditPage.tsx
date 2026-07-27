import { useMemo } from 'react';
import { Link, useLocation, useRoute } from 'wouter';
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
import { isOpenMaintenance } from '@/lib/maintenance-record';
import {
  formValuesToMaintenanceRecordInput,
  maintenanceRecordToFormValues,
  type MaintenanceRecordFormValues,
} from '@/lib/maintenance-form';
import { maintenanceDetailPath, registeredRoutes } from '@/lib/routes';
import UnauthorizedPage from '@/pages/UnauthorizedPage';

export default function MaintenanceEditPage() {
  const [, params] = useRoute(registeredRoutes.maintenanceEdit);
  const { user } = useAuth();
  const { current, scope } = useDepartment();
  const repository = useMockRepository();
  const [, setLocation] = useLocation();
  const recordId = params?.id;

  const record = useMemo(
    () => (recordId ? repository.getMaintenanceRecordInScope(recordId, scope) : undefined),
    [recordId, repository, scope],
  );
  const machines = useMemo(
    () =>
      current
        ? repository.listMachinesForDepartment(current.id, scope).filter((m) => !m.isArchived)
        : [],
    [current, repository, scope],
  );
  const technicians = useMemo(() => repository.listTechnicians(), [repository]);

  const initialValues = useMemo(
    () => (record ? maintenanceRecordToFormValues(record) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [recordId],
  );

  if (!can(user, 'maintenance:edit')) {
    return <UnauthorizedPage />;
  }

  if (!record || !initialValues) {
    return (
      <div className="max-w-2xl">
        <EmptyState
          title="Maintenance record not found"
          description={`No maintenance record matches the identifier "${recordId ?? ''}".`}
          action={
            <Link href={registeredRoutes.maintenance}>
              <Button variant="outline">
                <ArrowLeft size={16} className="mr-2" aria-hidden="true" /> Back to maintenance
              </Button>
            </Link>
          }
        />
      </div>
    );
  }

  const handleSubmit = async (
    values: MaintenanceRecordFormValues,
  ): Promise<MaintenanceRecordFormSubmitResult> => {
    const result = mockRepository.updateMaintenanceRecord(
      record.id,
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

    setLocation(maintenanceDetailPath(record.id));
    return { ok: true };
  };

  return (
    <div className="max-w-5xl space-y-6">
      <Link href={maintenanceDetailPath(record.id)}>
        <Button variant="ghost" size="sm">
          <ArrowLeft size={16} className="mr-2" aria-hidden="true" /> Back to record
        </Button>
      </Link>

      <PageHeader
        title={`Edit ${record.type} maintenance`}
        description={`Update the record for ${record.machineCode}.`}
      />

      {!isOpenMaintenance(record) ? (
        <FeedbackMessage
          feedback={{
            state: 'validation',
            title: 'This record is closed',
            description:
              'Completed or cancelled records are read-only. Reopen the record before editing.',
          }}
        />
      ) : (
        <>
          <FeedbackMessage
            feedback={{
              state: 'validation',
              title: 'Preview mode — data is not persisted',
              description:
                'Edits are saved to the in-memory preview store and reset on page reload.',
            }}
          />
          <MaintenanceRecordForm
            mode="edit"
            initialValues={initialValues}
            machines={machines}
            technicians={technicians}
            onSubmit={handleSubmit}
            onCancel={() => setLocation(maintenanceDetailPath(record.id))}
          />
        </>
      )}
    </div>
  );
}
