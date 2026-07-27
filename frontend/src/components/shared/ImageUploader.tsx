import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { UploadCloud, X, FileImage, CheckCircle2, CircleAlert } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';
import {
  ACCEPTED_IMAGE_LABEL,
  ACCEPTED_IMAGE_TYPES,
  MAX_IMAGE_BYTES,
  describeImageSize,
  isAcceptedImageType,
} from '@/lib/image-policy';

interface ImageUploaderProps {
  onUpload?: (file: File) => void;
  className?: string;
  defaultImage?: string;
}

export function ImageUploader({ onUpload, className, defaultImage }: ImageUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(defaultImage || null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const errorId = useId();
  const hintId = useId();

  // Object URLs are leaked unless they are explicitly revoked, and the simulated
  // upload interval keeps firing after unmount. Both are tracked in refs so a single
  // cleanup path handles replace, remove, and unmount.
  const objectUrlRef = useRef<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const releaseObjectUrl = useCallback(() => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  }, []);

  useEffect(
    () => () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      releaseObjectUrl();
    },
    [releaseObjectUrl],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const processFile = useCallback(
    (file: File) => {
      // Validation failures used to call `alert()`, which is a blocking browser dialog
      // that no other surface in this app uses and that a screen reader announces out
      // of context. They now render inline as an alert region next to the control.
      if (!isAcceptedImageType(file.type)) {
        setError(`${file.name} is not a supported format. Upload a ${ACCEPTED_IMAGE_LABEL} image.`);
        return;
      }
      if (file.size > MAX_IMAGE_BYTES) {
        setError(
          `${file.name} is ${describeImageSize(file.size)}, over the ${describeImageSize(MAX_IMAGE_BYTES)} limit.`,
        );
        return;
      }

      setError(null);
      releaseObjectUrl();
      const objectUrl = URL.createObjectURL(file);
      objectUrlRef.current = objectUrl;
      setPreviewUrl(objectUrl);

      // Simulated upload. Replaced by a real Cloudinary signature round trip in the
      // backend phase; the progress UI is deliberately already in place.
      setUploading(true);
      setProgress(0);

      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = setInterval(() => {
        setProgress((p) => {
          if (p >= 100) {
            if (intervalRef.current) clearInterval(intervalRef.current);
            intervalRef.current = null;
            setUploading(false);
            if (onUpload) onUpload(file);
            return 100;
          }
          return p + 10;
        });
      }, 100);
    },
    [onUpload, releaseObjectUrl],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        processFile(e.dataTransfer.files[0]);
      }
    },
    [processFile],
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFile(e.target.files[0]);
    }
    // Clearing the value lets the user re-pick the same file after a rejection;
    // otherwise the change event never fires again and the control looks dead.
    e.target.value = '';
  };

  const removeImage = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = null;
    releaseObjectUrl();
    setPreviewUrl(null);
    setProgress(0);
    setUploading(false);
    setError(null);
  };

  return (
    <div className={cn('w-full', className)}>
      {!previewUrl ? (
        <label
          className={cn(
            'flex h-48 w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed bg-muted/40 transition-colors hover:bg-muted',
            'focus-within:outline-none focus-within:ring-2 focus-within:ring-ring',
            isDragging ? 'border-primary bg-primary/5 dark:bg-primary/10' : 'border-input',
            error && 'border-destructive/60',
          )}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div className="flex flex-col items-center justify-center pb-6 pt-5">
            <UploadCloud
              aria-hidden="true"
              className={cn('mb-3 h-10 w-10 text-muted-foreground', isDragging && 'text-primary')}
            />
            <p className="mb-2 text-sm text-muted-foreground">
              <span className="font-semibold text-primary">Click to upload</span> or drag and drop
            </p>
            <p id={hintId} className="text-xs text-muted-foreground">
              {ACCEPTED_IMAGE_LABEL} (max {describeImageSize(MAX_IMAGE_BYTES)})
            </p>
          </div>
          <input
            ref={inputRef}
            type="file"
            className="sr-only"
            accept={ACCEPTED_IMAGE_TYPES.join(',')}
            aria-describedby={error ? `${hintId} ${errorId}` : hintId}
            aria-invalid={error ? true : undefined}
            onChange={handleFileChange}
          />
        </label>
      ) : (
        <div className="group relative overflow-hidden rounded-lg border bg-muted/40">
          {uploading ? (
            <div className="flex h-48 flex-col items-center justify-center p-6 text-center">
              <FileImage className="mb-4 h-8 w-8 animate-pulse text-muted-foreground" />
              <div className="w-full max-w-xs space-y-2">
                <div className="flex justify-between text-xs font-medium text-muted-foreground">
                  <span>Uploading…</span>
                  <span>{progress}%</span>
                </div>
                <Progress value={progress} className="h-2" />
                <p className="sr-only" role="status">
                  Upload {progress} percent complete
                </p>
              </div>
            </div>
          ) : (
            <>
              <img
                src={previewUrl}
                alt="Selected image preview"
                className="h-48 w-full object-cover"
              />
              <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                <button
                  type="button"
                  onClick={removeImage}
                  className="flex items-center gap-2 rounded bg-background px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <X size={16} aria-hidden="true" /> Remove
                </button>
              </div>
              <div className="absolute left-2 top-2 flex items-center gap-1 rounded bg-emerald-600 px-2 py-1 text-xs font-medium text-white shadow">
                <CheckCircle2 size={12} aria-hidden="true" /> Uploaded
              </div>
            </>
          )}
        </div>
      )}

      {error ? (
        <p
          id={errorId}
          role="alert"
          className="mt-2 flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-2 text-sm text-destructive"
        >
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </p>
      ) : null}
    </div>
  );
}
