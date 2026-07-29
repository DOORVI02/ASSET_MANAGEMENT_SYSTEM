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
import { useAuth } from '@/hooks/use-auth';
import { can } from '@/lib/permissions';
import { useDepartment } from '@/hooks/use-department';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createMaintenanceRecord } from '@/lib/supabase/maintenance';
import { listAllMachinesInScope } from '@/lib/supabase/machines';
import { listTechnicians } from '@/lib/supabase/technicians';
import { queryKeys } from '@/lib/supabase/query-keys';
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
  const queryClient = useQueryClient();
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

  // Archived machines are excluded: work cannot be newly scheduled against a retired asset.
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

  if (!can(user, 'maintenance:add')) {
    return <UnauthorizedPage />;
  }

  const handleSubmit = async (
    values: MaintenanceRecordFormValues,
  ): Promise<MaintenanceRecordFormSubmitResult> => {
    // No actor argument: the audit trigger records `auth.uid()` server-side.
    const result = await createMaintenanceRecord(formValuesToMaintenanceRecordInput(values));

    if (!result.ok) {
      return {
        ok: false,
        message: result.message,
        field: result.reason === 'unknown_machine' ? 'machineId' : undefined,
      };
    }

    await queryClient.invalidateQueries({ queryKey: ['maintenance'] });
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
