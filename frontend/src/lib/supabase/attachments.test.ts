import { afterEach, describe, expect, it, vi } from 'vitest';

const invoke = vi.fn();
vi.mock('@/lib/supabase', () => ({
  getSupabaseClient: () => ({ functions: { invoke } }),
}));

import {
  deleteCloudinaryAttachment,
  finalizeCloudinaryUpload,
  signCloudinaryUpload,
  uploadToCloudinary,
} from './attachments';

afterEach(() => {
  invoke.mockReset();
});

describe('signCloudinaryUpload', () => {
  it('invokes cloudinary-sign with the request params and returns the signed payload', async () => {
    const signed = {
      cloudName: 'bsp-asm',
      apiKey: 'key',
      timestamp: 1700000000,
      signature: 'sig',
      folder: 'sail-plant-maintenance/machine',
      publicId: 'machine-1',
      overwrite: true,
      uploadUrl: 'https://api.cloudinary.com/v1_1/bsp-asm/image/upload',
    };
    invoke.mockResolvedValueOnce({ data: signed, error: null });

    const result = await signCloudinaryUpload({
      entityType: 'machine',
      entityId: 'machine-1',
      fileName: 'photo.png',
      fileType: 'image/png',
      fileSize: 1000,
    });

    expect(invoke).toHaveBeenCalledWith('cloudinary-sign', {
      body: {
        entityType: 'machine',
        entityId: 'machine-1',
        fileName: 'photo.png',
        fileType: 'image/png',
        fileSize: 1000,
      },
    });
    expect(result).toEqual(signed);
  });

  it('throws the Edge Function error rather than swallowing it', async () => {
    const error = new Error('Only Officers and Supervisors may upload images.');
    invoke.mockResolvedValueOnce({ data: null, error });

    await expect(
      signCloudinaryUpload({
        entityType: 'machine',
        entityId: 'machine-1',
        fileName: 'photo.png',
        fileType: 'image/png',
        fileSize: 1000,
      }),
    ).rejects.toThrow(error);
  });
});

describe('finalizeCloudinaryUpload', () => {
  it('invokes cloudinary-finalize and maps the returned row through mapAttachmentRow', async () => {
    invoke.mockResolvedValueOnce({
      data: {
        id: 'attachment-1',
        entity_id: 'machine-1',
        entity_type: 'machine',
        file_name: 'photo.png',
        file_type: 'image/png',
        file_size: 1000,
        uploaded_by: 'profile-1',
        uploaded_at: '2026-01-01T00:00:00Z',
        url: 'https://res.cloudinary.com/bsp-asm/image/upload/photo.png',
        cloudinary_public_id: 'sail-plant-maintenance/machine/machine-1',
        status: 'ready',
      },
      error: null,
    });

    const attachment = await finalizeCloudinaryUpload({
      entityType: 'machine',
      entityId: 'machine-1',
      publicId: 'sail-plant-maintenance/machine/machine-1',
      fileName: 'photo.png',
    });

    expect(invoke).toHaveBeenCalledWith('cloudinary-finalize', {
      body: {
        entityType: 'machine',
        entityId: 'machine-1',
        publicId: 'sail-plant-maintenance/machine/machine-1',
        fileName: 'photo.png',
      },
    });
    expect(attachment).toEqual({
      id: 'attachment-1',
      entityId: 'machine-1',
      entityType: 'machine',
      fileName: 'photo.png',
      fileType: 'image/png',
      fileSize: 1000,
      uploadedBy: 'profile-1',
      uploadedAt: '2026-01-01T00:00:00Z',
      url: 'https://res.cloudinary.com/bsp-asm/image/upload/photo.png',
    });
  });
});

describe('deleteCloudinaryAttachment', () => {
  it('invokes cloudinary-delete with the attachment id', async () => {
    invoke.mockResolvedValueOnce({ data: { ok: true }, error: null });

    await deleteCloudinaryAttachment('attachment-1');

    expect(invoke).toHaveBeenCalledWith('cloudinary-delete', {
      body: { attachmentId: 'attachment-1' },
    });
  });

  it('throws when the Edge Function reports an error', async () => {
    const error = new Error('This attachment is outside your department scope.');
    invoke.mockResolvedValueOnce({ data: null, error });

    await expect(deleteCloudinaryAttachment('attachment-1')).rejects.toThrow(error);
  });
});

describe('uploadToCloudinary', () => {
  const signed = {
    cloudName: 'bsp-asm',
    apiKey: 'key',
    timestamp: 1700000000,
    signature: 'sig',
    folder: 'sail-plant-maintenance/machine',
    publicId: 'machine-1',
    overwrite: true,
    uploadUrl: 'https://api.cloudinary.com/v1_1/bsp-asm/image/upload',
  };
  const file = new File(['x'], 'photo.png', { type: 'image/png' });

  class FakeXhr {
    static instances: FakeXhr[] = [];
    upload = { onprogress: null as ((event: ProgressEvent) => void) | null };
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    status = 200;
    responseText = '';
    openedUrl?: string;
    body?: FormData;

    constructor() {
      FakeXhr.instances.push(this);
    }
    open(_method: string, url: string) {
      this.openedUrl = url;
    }
    send(body: FormData) {
      this.body = body;
    }
  }

  it('posts the signed params and file, resolving with the public_id and secure_url', async () => {
    const originalXhr = globalThis.XMLHttpRequest;
    // @ts-expect-error -- test double, not a full XMLHttpRequest implementation.
    globalThis.XMLHttpRequest = FakeXhr;
    FakeXhr.instances = [];

    try {
      const promise = uploadToCloudinary(signed, file);
      const xhr = FakeXhr.instances[0];
      xhr.status = 200;
      xhr.responseText = JSON.stringify({
        public_id: 'sail-plant-maintenance/machine/machine-1',
        secure_url: 'https://res.cloudinary.com/bsp-asm/image/upload/machine-1.png',
      });
      xhr.onload?.();

      const result = await promise;
      expect(xhr.openedUrl).toBe(signed.uploadUrl);
      expect(xhr.body?.get('api_key')).toBe(signed.apiKey);
      expect(xhr.body?.get('overwrite')).toBe('true');
      expect(result).toEqual({
        publicId: 'sail-plant-maintenance/machine/machine-1',
        secureUrl: 'https://res.cloudinary.com/bsp-asm/image/upload/machine-1.png',
      });
    } finally {
      globalThis.XMLHttpRequest = originalXhr;
    }
  });

  it('omits the overwrite field for a multi-image entity', async () => {
    const originalXhr = globalThis.XMLHttpRequest;
    // @ts-expect-error -- test double, not a full XMLHttpRequest implementation.
    globalThis.XMLHttpRequest = FakeXhr;
    FakeXhr.instances = [];

    try {
      const promise = uploadToCloudinary({ ...signed, overwrite: false }, file);
      const xhr = FakeXhr.instances[0];
      xhr.status = 200;
      xhr.responseText = JSON.stringify({ public_id: 'x', secure_url: 'y' });
      xhr.onload?.();
      await promise;

      expect(xhr.body?.get('overwrite')).toBeNull();
    } finally {
      globalThis.XMLHttpRequest = originalXhr;
    }
  });

  it('rejects when Cloudinary responds with a non-2xx status', async () => {
    const originalXhr = globalThis.XMLHttpRequest;
    // @ts-expect-error -- test double, not a full XMLHttpRequest implementation.
    globalThis.XMLHttpRequest = FakeXhr;
    FakeXhr.instances = [];

    try {
      const promise = uploadToCloudinary(signed, file);
      const xhr = FakeXhr.instances[0];
      xhr.status = 400;
      xhr.onload?.();

      await expect(promise).rejects.toThrow('Cloudinary upload failed with status 400.');
    } finally {
      globalThis.XMLHttpRequest = originalXhr;
    }
  });

  it('rejects on a network error', async () => {
    const originalXhr = globalThis.XMLHttpRequest;
    // @ts-expect-error -- test double, not a full XMLHttpRequest implementation.
    globalThis.XMLHttpRequest = FakeXhr;
    FakeXhr.instances = [];

    try {
      const promise = uploadToCloudinary(signed, file);
      const xhr = FakeXhr.instances[0];
      xhr.onerror?.();

      await expect(promise).rejects.toThrow('Cloudinary upload failed due to a network error.');
    } finally {
      globalThis.XMLHttpRequest = originalXhr;
    }
  });
});
