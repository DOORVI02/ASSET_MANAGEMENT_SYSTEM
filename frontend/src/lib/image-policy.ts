/**
 * Accepted image formats, per the 2026-07-26 decision recorded in `.agents/plan.md`:
 * JPEG/JPG, PNG, and AVIF at up to 5 MB. WebP is deliberately **not** accepted.
 *
 * Lives outside the uploader component so the same policy can be reused by machine and
 * part image forms, and so the uploader file only exports a component (react-refresh).
 */
export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/avif'];

export const ACCEPTED_IMAGE_LABEL = 'JPG, PNG or AVIF';

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export function isAcceptedImageType(type: string): boolean {
  return ACCEPTED_IMAGE_TYPES.includes(type);
}

/** Human-readable byte size for validation messages, e.g. "5 MB" or "7.4 MB". */
export function describeImageSize(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) {
    const rounded = Math.round(mb * 10) / 10;
    return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)} MB`;
  }
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
