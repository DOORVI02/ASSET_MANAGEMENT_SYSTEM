import { useCallback, useMemo, useState } from 'react';
import { Link, useLocation, useSearch } from 'wouter';
import { ArrowLeft } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { Button } from '@/components/ui/button';
import { PartForm, type PartFormSubmitResult } from '@/components/parts/PartForm';
import { useAuth } from '@/hooks/use-auth';
import { can } from '@/lib/permissions';
import { useDepartment } from '@/hooks/use-department';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createPart, isPartSerialTaken } from '@/lib/supabase/parts';
import { listAllMachinesInScope } from '@/lib/supabase/machines';
import { queryKeys } from '@/lib/supabase/query-keys';
import { emptyPartFormValues, formValuesToPartInput, type PartFormValues } from '@/lib/part-form';
import { partDetailPath, registeredRoutes } from '@/lib/routes';
import UnauthorizedPage from '@/pages/UnauthorizedPage';

export default function PartAddPage() {
  const { user } = useAuth();
  const { current, scope } = useDepartment();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const searchString = useSearch();

  // A machine can be preselected when arriving from a machine's Parts tab.
  const presetMachineId = useMemo(
    () => new URLSearchParams(searchString).get('machine') ?? '',
    [searchString],
  );
  const [initialValues] = useState<PartFormValues>(() => emptyPartFormValues(presetMachineId));

  // Parts are fitted to a machine, so the picker needs the department's machines. Archived
  // ones are excluded: a part cannot be newly fitted to a machine that has been retired.
  const { data: machinesInScope = [] } = useQuery({
    queryKey: [...queryKeys.machines.inScope(scope.departmentIds), current?.id ?? ''],
    queryFn: () => listAllMachinesInScope(scope, current?.id),
    enabled: Boolean(current) && scope.departmentIds.length > 0,
  });

  const machines = useMemo(
    () => machinesInScope.filter((machine) => !machine.isArchived),
    [machinesInScope],
  );

  const isSerialTaken = useCallback(
    (serialNumber: string) => isPartSerialTaken(serialNumber),
    [],
  );

  if (!can(user, 'parts:add')) {
    return <UnauthorizedPage />;
  }

  const handleSubmit = async (values: PartFormValues): Promise<PartFormSubmitResult> => {
    // No actor argument: the audit trigger records `auth.uid()` server-side.
    const result = await createPart(formValuesToPartInput(values));

    if (!result.ok) {
      return {
        ok: false,
        message: result.message,
        field:
          result.reason === 'duplicate_serial'
            ? 'serialNumber'
            : result.reason === 'unknown_machine'
              ? 'machineId'
              : undefined,
      };
    }

    await queryClient.invalidateQueries({ queryKey: ['parts'] });
    setLocation(partDetailPath(result.data.id));
    return { ok: true };
  };

  return (
    <div className="max-w-5xl space-y-6">
      <Link href={registeredRoutes.parts}>
        <Button variant="ghost" size="sm">
          <ArrowLeft size={16} className="mr-2" aria-hidden="true" /> Back to parts
        </Button>
      </Link>

      <PageHeader
        title="Fit part"
        description="Record a component fitted to a machine in this department."
      />



      {machines.length === 0 ? (
        <EmptyState
          title="No machines available"
          description="This department has no active machines to fit a component to."
        />
      ) : (
        <PartForm
          mode="create"
          initialValues={initialValues}
          machines={machines}
          isSerialTaken={isSerialTaken}
          onSubmit={handleSubmit}
          onCancel={() => setLocation(registeredRoutes.parts)}
        />
      )}
    </div>
  );
}
