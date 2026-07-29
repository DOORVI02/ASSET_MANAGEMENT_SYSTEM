import { useState } from 'react';
import { ImageOff, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/shared/EmptyState';
import { FeedbackMessage } from '@/components/shared/FeedbackMessage';
import { ImageUploader } from '@/components/shared/ImageUploader';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { deleteCloudinaryAttachment, uploadAndFinalizeImage } from '@/lib/supabase/attachments';
import type { Attachment, FeedbackMessage as FeedbackModel } from '@/lib/types';

interface MachineImageProps {
  machineId: string;
  machineCode: string;
  image?: Attachment;
  canManage: boolean;
  isArchived: boolean;
  /** Refetches the parent's image query once an upload or delete has landed. */
  onChanged: () => Promise<unknown>;
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
 * whatever was there before — enforced by the database, not here: the partial unique index
 * `attachments_single_per_machine_or_part_idx` permits one attachment row per machine, and
 * `cloudinary-sign` issues a fixed `public_id` with `overwrite=true` for single-image
 * entities so the replaced asset is overwritten rather than orphaned.
 */
export function MachineImage({
  machineId,
  machineCode,
  image,
  canManage,
  isArchived,
  onChanged,
}: MachineImageProps) {
  const [feedback, setFeedback] = useState<FeedbackModel | null>(null);

  const [isBusy, setIsBusy] = useState(false);

  const handleUpload = async (file: File) => {
    const replacing = Boolean(image);
    setIsBusy(true);
    try {
      // sign -> upload -> finalize. The API secret never reaches the browser; the signature
      // does, and Cloudinary validates it.
      const attachment = await uploadAndFinalizeImage({
        entityType: 'machine',
        entityId: machineId,
        file,
      });
      await onChanged();
      setFeedback({
        state: 'success',
        title: replacing
          ? `Replaced the image for ${machineCode}`
          : `Set the image for ${machineCode}`,
        description: `${attachment.fileName} was uploaded.`,
      });
    } catch (uploadError) {
      setFeedback({
        state: 'validation',
        title: 'Image not saved',
        description:
          uploadError instanceof Error ? uploadError.message : 'The image could not be uploaded.',
      });
    } finally {
      setIsBusy(false);
    }
  };

  const handleRemove = async () => {
    if (!image) return;
    setIsBusy(true);
    try {
      // Deletes the Cloudinary asset and the row together. Dropping only the row would
      // orphan the asset — the drift `reconcile-cloudinary-orphans.mjs` exists to find.
      await deleteCloudinaryAttachment(image.id);
      await onChanged();
      setFeedback({
        state: 'success',
        title: `Removed ${image.fileName}`,
        description: 'This machine no longer has an image.',
      });
    } catch (deleteError) {
      setFeedback({
        state: 'validation',
        title: 'Image not removed',
        description:
          deleteError instanceof Error ? deleteError.message : 'The image could not be removed.',
      });
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div className="space-y-6">
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
                    <Button variant="outline" size="sm" disabled={isBusy}>
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
