import { api } from './client';
import { cloudinaryDirect } from './config';
import { PropertyMedia } from '../types';
import { PickedFile } from '../lib/filePicker';

type MediaKind = 'image' | 'document';

// Upload one file straight to Cloudinary via an unsigned preset (browser → CDN),
// bypassing our backend. Used when `cloudinaryDirect` is configured.
async function uploadDirect(file: PickedFile, kind: MediaKind): Promise<PropertyMedia> {
  const { cloudName, uploadPreset } = cloudinaryDirect!;
  const resource = kind === 'document' ? 'raw' : 'image';
  const form = new FormData();
  form.append('file', file.part as any, file.name);
  form.append('upload_preset', uploadPreset);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/${resource}/upload`, {
    method: 'POST',
    body: form as any,
  });
  const data: any = await res.json().catch(() => null);
  if (!res.ok || !data?.secure_url) {
    const msg = data?.error?.message || 'Cloudinary upload failed.';
    // Most common misconfig: the preset isn't set to Unsigned in the dashboard.
    if (/whitelisted for unsigned/i.test(msg)) {
      throw new Error(
        `Upload preset "${uploadPreset}" is not Unsigned. In Cloudinary → Settings → Upload → open the preset → set Signing Mode to "Unsigned" and save.`
      );
    }
    throw new Error(msg);
  }
  return {
    url: data.secure_url,
    publicId: data.public_id,
    resourceType: data.resource_type,
    format: data.format,
    bytes: data.bytes,
    width: data.width,
    height: data.height,
    name: file.name,
    mimeType: file.type,
  };
}

export const uploadsApi = {
  // Uploads picked files and returns media descriptors to attach to a property.
  // Prefers direct browser→Cloudinary upload when configured; otherwise routes
  // through the backend (which needs server-side reachability to Cloudinary).
  upload: async (files: PickedFile[], type: MediaKind = 'image') => {
    if (cloudinaryDirect) {
      const media = await Promise.all(files.map((f) => uploadDirect(f, type)));
      return { media };
    }
    const form = new FormData();
    files.forEach((f) => form.append('files', f.part as Blob, f.name));
    return api.upload<{ media: PropertyMedia[] }>(`/uploads?type=${type}`, form);
  },
};
