import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ImageUploader } from './ImageUploader';
import { MAX_IMAGE_BYTES, describeImageSize } from '@/lib/image-policy';

function fileOfType(name: string, type: string, bytes = 1024): File {
  const file = new File(['x'], name, { type });
  // `File` size is derived from its content, so it is redefined rather than constructed
  // from a multi-megabyte buffer the test would otherwise have to allocate.
  Object.defineProperty(file, 'size', { value: bytes });
  return file;
}

function fileInput(): HTMLInputElement {
  const input = document.querySelector('input[type="file"]');
  if (!(input instanceof HTMLInputElement)) throw new Error('No file input rendered');
  return input;
}

describe('ImageUploader validation', () => {
  beforeEach(() => {
    // jsdom implements neither; the component only needs them not to throw.
    URL.createObjectURL = vi.fn(() => 'blob:preview');
    URL.revokeObjectURL = vi.fn();
  });

  it('advertises the confirmed formats and size limit, and not WebP', () => {
    render(<ImageUploader />);

    expect(screen.getByText(/JPG, PNG or AVIF/)).toBeInTheDocument();
    expect(screen.queryByText(/WebP/i)).not.toBeInTheDocument();
    expect(fileInput().accept).toBe('image/jpeg,image/png,image/avif');
  });

  it('rejects an unsupported format inline rather than through a blocking dialog', async () => {
    // A failure here would previously have been an unhandled `alert()` call.
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    render(<ImageUploader />);

    // applyAccept:false bypasses userEvent's own accept filtering, so the component's
    // validation is what is under test rather than the browser file picker's.
    await userEvent.upload(fileInput(), fileOfType('diagram.webp', 'image/webp'), {
      applyAccept: false,
    });

    const alertRegion = await screen.findByRole('alert');
    expect(alertRegion).toHaveTextContent(/diagram\.webp is not a supported format/);
    expect(alertSpy).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });

  it('rejects an oversized file and names the actual size', async () => {
    render(<ImageUploader />);

    await userEvent.upload(
      fileInput(),
      fileOfType('huge.png', 'image/png', MAX_IMAGE_BYTES + 1024 * 1024),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      new RegExp(`over the ${describeImageSize(MAX_IMAGE_BYTES)} limit`),
    );
  });

  it('marks the control invalid and links the message to it', async () => {
    render(<ImageUploader />);

    await userEvent.upload(fileInput(), fileOfType('notes.txt', 'text/plain'), {
      applyAccept: false,
    });

    await screen.findByRole('alert');
    const input = fileInput();
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input.getAttribute('aria-describedby')).toContain(
      screen.getByRole('alert').getAttribute('id'),
    );
  });

  it('accepts a permitted format and clears any previous error', async () => {
    render(<ImageUploader />);

    await userEvent.upload(fileInput(), fileOfType('bad.gif', 'image/gif'), { applyAccept: false });
    expect(await screen.findByRole('alert')).toBeInTheDocument();

    await userEvent.upload(fileInput(), fileOfType('nameplate.avif', 'image/avif'));

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(URL.createObjectURL).toHaveBeenCalled();
  });

  it('revokes the object URL when the image is removed, so the blob is not leaked', async () => {
    render(<ImageUploader />);

    await userEvent.upload(fileInput(), fileOfType('nameplate.png', 'image/png'));
    // The simulated upload runs for ten 100 ms ticks before the preview appears.
    const remove = await screen.findByRole('button', { name: /Remove/ }, { timeout: 4000 });
    await userEvent.click(remove);

    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:preview');
  });
});

describe('describeImageSize', () => {
  it('renders whole and fractional megabytes without trailing noise', () => {
    expect(describeImageSize(5 * 1024 * 1024)).toBe('5 MB');
    expect(describeImageSize(7.45 * 1024 * 1024)).toBe('7.5 MB');
  });

  it('falls back to kilobytes below one megabyte', () => {
    expect(describeImageSize(200 * 1024)).toBe('200 KB');
  });
});
