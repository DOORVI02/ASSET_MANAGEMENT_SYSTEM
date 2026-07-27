import { useState } from 'react';
import { ImageOff, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/shared/EmptyState';
import { FeedbackMessage } from '@/components/shared/FeedbackMessage';
import { ImageUploader } from '@/components/shared/ImageUploader';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { mockRepository } from '@/lib/mock-repository';
import type { Attachment, FeedbackMessage as FeedbackModel } from '@/lib/types';

interface MachineImageProps {
  machineId: string;
  machineCode: string;
  image?: Attachment;
  canManage: boolean;
  isArchived: boolean;
  actorId: string;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * The single image for one machine.
 *
 * A machine carries exactly one image (decision 2026-07-26), so uploading replaces
 * whatever was there before. Uploads are simulated end to end: the selected file
 * becomes a local object URL and an in-memory attachment row. No Cloudinary or
 * network call happens in this phase.
 */
export function MachineImage({
  machineId,
  machineCode,
  image,
  canManage,
  isArchived,
  actorId,
}: MachineImageProps) {
  const [feedback, setFeedback] = useState<FeedbackModel | null>(null);

  const handleUpload = (file: File) => {
    const replacing = Boolean(image);
    const result = mockRepository.setMachineImage(
      machineId,
      {
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        url: URL.createObjectURL(file),
      },
      actorId,
    );

    setFeedback(
      result.ok
        ? {
            state: 'success',
            title: replacing
              ? `Replaced the image for ${machineCode}`
              : `Set the image for ${machineCode}`,
            description: `${result.data.fileName} is stored in the preview store for this session.`,
          }
        : { state: 'validation', title: 'Image not saved', description: result.message },
    );
  };

  const handleRemove = () => {
    const result = mockRepository.removeMachineImage(machineId, actorId);
    setFeedback(
      result.ok
        ? {
            state: 'success',
            title: `Removed ${result.data.fileName}`,
            description: 'This machine no longer has an image in the preview store.',
          }
        : { state: 'validation', title: 'Image not removed', description: result.message },
    );
  };

  return (
    <div className="space-y-6">
      <FeedbackMessage
        feedback={{
          state: 'validation',
          title: 'Preview-only image handling',
          description:
            'Images live in browser memory for this session only. Cloudinary uploads through Supabase Edge Functions arrive in a later phase.',
        }}
      />

      {feedback ? <FeedbackMessage feedback={feedback} /> : null}

      {image ? (
        <section aria-labelledby="machine-image-heading">
          <h3 id="machine-image-heading" className="mb-3 text-sm font-semibold">
            Machine image
          </h3>
          <div className="overflow-hidden rounded-lg border bg-card">
            <img
              src={image.url}
              alt={`Image of ${machineCode}: ${image.fileName}`}
              className="h-64 w-full bg-muted/30 object-contain"
            />
            <div className="flex flex-col gap-2 border-t p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{image.fileName}</p>
                <p className="text-xs text-muted-foreground">
                  {formatFileSize(image.fileSize)} · {image.fileType}
                </p>
              </div>
              {canManage && !isArchived ? (
                <ConfirmDialog
                  trigger={
                    <Button variant="outline" size="sm">
                      <Trash2 size={14} className="mr-2" aria-hidden="true" /> Remove
                    </Button>
                  }
                  title="Remove machine image?"
                  description={`Remove ${image.fileName} from ${machineCode}? You can upload a replacement afterwards.`}
                  confirmText="Remove image"
                  onConfirm={handleRemove}
                  variant="destructive"
                />
              ) : null}
            </div>
          </div>
        </section>
      ) : (
        <EmptyState
          icon={ImageOff}
          title="No image yet"
          description={
            canManage && !isArchived
              ? `Upload the image for ${machineCode} below.`
              : `No image has been added for ${machineCode}.`
          }
        />
      )}

      {canManage && !isArchived ? (
        <section aria-labelledby="upload-heading">
          <h3 id="upload-heading" className="mb-3 text-sm font-semibold">
            {image ? 'Replace the image' : 'Add an image'}
          </h3>
          <ImageUploader key={image?.id ?? 'empty'} onUpload={handleUpload} />
          <p className="mt-2 text-xs text-muted-foreground">
            JPEG, PNG, or AVIF up to 5 MB. A machine carries one image; uploading replaces the
            current one.
          </p>
        </section>
      ) : isArchived ? (
        <p className="text-sm text-muted-foreground">
          Archived machines are read-only. Restore this machine to change its image.
        </p>
      ) : null}
    </div>
  );
}
