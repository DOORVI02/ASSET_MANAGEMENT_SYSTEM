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
import { useAuth } from '@/hooks/use-auth';
import { can } from '@/lib/permissions';
import { useDepartment } from '@/hooks/use-department';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getMaintenanceRecordInScope, updateMaintenanceRecord } from '@/lib/supabase/maintenance';
import { listAllMachinesInScope } from '@/lib/supabase/machines';
import { listTechnicians } from '@/lib/supabase/technicians';
import { queryKeys } from '@/lib/supabase/query-keys';
import { LoadingState } from '@/components/shared/LoadingState';
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
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const recordId = params?.id;

  const { data: record, isPending } = useQuery({
    queryKey: queryKeys.maintenance.recordDetail(recordId ?? ''),
    queryFn: () => getMaintenanceRecordInScope(recordId ?? '', scope),
    enabled: Boolean(recordId) && scope.departmentIds.length > 0,
  });
  const { data: machinesInScope = [] } = useQuery({
    queryKey: [...queryKeys.machines.inScope(scope.departmentIds), current?.id ?? ''],
    queryFn: () => listAllMachinesInScope(scope, current?.id),
    enabled: Boolean(current) && scope.departmentIds.length > 0,
  });
  const machines = useMemo(
    () => machinesInScope.filter((machine) => !machine.isArchived),
    [machinesInScope],
  );
  const { data: technicians = [] } = useQuery({
    queryKey: queryKeys.technicians.list(),
    queryFn: listTechnicians,
  });

  const initialValues = useMemo(
    () => (record ? maintenanceRecordToFormValues(record) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [recordId],
  );

  if (!can(user, 'maintenance:edit')) {
    return <UnauthorizedPage />;
  }

  if (isPending) {
    return (
      <div className="max-w-2xl">
        <LoadingState label="Loading maintenance record…" />
      </div>
    );
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
    const result = await updateMaintenanceRecord(record.id, formValuesToMaintenanceRecordInput(values));

    if (!result.ok) {
      return {
        ok: false,
        message: result.message,
        field: result.reason === 'unknown_machine' ? 'machineId' : undefined,
      };
    }

    await queryClient.invalidateQueries({ queryKey: ['maintenance'] });
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
