import { useCallback, useMemo, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { ArrowLeft } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { PageSection } from '@/components/shared/PageSection';
import { FeedbackMessage } from '@/components/shared/FeedbackMessage';
import { ImageUploader } from '@/components/shared/ImageUploader';
import { Button } from '@/components/ui/button';
import { MachineForm, type MachineFormSubmitResult } from '@/components/machines/MachineForm';
import { useAuth } from '@/lib/mock-auth';
import { can } from '@/lib/permissions';
import { mockRepository } from '@/lib/mock-repository';
import { useMockRepository } from '@/hooks/use-mock-repository';
import {
  emptyMachineFormValues,
  formValuesToMachineInput,
  type MachineFormValues,
} from '@/lib/machine-form';
import { machineDetailPath } from '@/lib/routes';
import UnauthorizedPage from '@/pages/UnauthorizedPage';

export default function MachineAddPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const repository = useMockRepository();
  const [initialValues] = useState<MachineFormValues>(emptyMachineFormValues);

  const departments = useMemo(() => repository.listDepartments(), [repository]);

  // Reads the singleton directly so the check always sees the latest register.
  const isCodeTaken = useCallback((code: string) => mockRepository.isMachineCodeTaken(code), []);

  if (!can(user, 'machine:add')) {
    return <UnauthorizedPage />;
  }

  const handleSubmit = async (values: MachineFormValues): Promise<MachineFormSubmitResult> => {
    const result = mockRepository.createMachine(
      formValuesToMachineInput(values),
      user?.id ?? 'unknown',
    );

    if (!result.ok) {
      return {
        ok: false,
        message: result.message,
        field: result.reason === 'duplicate_code' ? 'code' : undefined,
      };
    }

    setLocation(machineDetailPath(result.data.id));
    return { ok: true };
  };

  return (
    <div className="max-w-5xl space-y-6">
      <Link href="/machines">
        <Button variant="ghost" size="sm">
          <ArrowLeft size={16} className="mr-2" aria-hidden="true" /> Back to register
        </Button>
      </Link>

      <PageHeader
        title="Add machine"
        description="Register a new machine in the plant asset register."
      />

      <FeedbackMessage
        feedback={{
          state: 'validation',
          title: 'Preview mode — data is not persisted',
          description:
            'This machine is saved to the in-memory preview store and resets on page reload. Supabase persistence arrives in a later phase.',
        }}
      />

      <MachineForm
        mode="create"
        initialValues={initialValues}
        departments={departments}
        isCodeTaken={isCodeTaken}
        onSubmit={handleSubmit}
        onCancel={() => setLocation('/machines')}
        imageSection={
          <PageSection
            title="Machine image"
            description="Preview-only uploader. Nothing is sent to Cloudinary during the frontend phase."
          >
            <ImageUploader />
            <p className="mt-3 text-xs text-muted-foreground">
              Images can be attached from the machine&apos;s Images tab once it has been created.
            </p>
          </PageSection>
        }
      />
    </div>
  );
}
