// Web file picking via a hidden <input type="file">. Returns descriptors whose
// `part` (a File/Blob) is what gets appended to FormData for upload.
export interface PickedFile {
  uri: string;
  name: string;
  type: string;
  size?: number;
  part: unknown; // a File on web
}

export const filePickerSupported = true;

// Downscale/compress a photo before upload. Phone photos are often 4–12 MB,
// which stalls uploads on normal uplinks; a 1600px JPEG is a few hundred KB and
// uploads instantly, with no visible quality loss for listings. Non-images and
// anything that fails to decode pass through untouched.
async function downscaleImage(file: File, maxDim = 1600, quality = 0.82): Promise<File> {
  if (!file.type.startsWith('image/') || file.type === 'image/gif') return file;
  try {
    // `from-image` applies EXIF orientation so portrait photos aren't sideways.
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions);
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
    // Already small enough — don't bother re-encoding.
    if (scale === 1 && file.size < 1_000_000) {
      bitmap.close?.();
      return file;
    }
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();
    const blob: Blob | null = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', quality));
    if (!blob || blob.size >= file.size) return file; // keep original if not smaller
    const name = file.name.replace(/\.[^.]+$/, '') + '.jpg';
    return new File([blob], name, { type: 'image/jpeg' });
  } catch {
    return file;
  }
}

export function pickFiles({
  accept = 'image/*',
  multiple = true,
}: { accept?: string; multiple?: boolean } = {}): Promise<PickedFile[]> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.multiple = multiple;
    input.style.position = 'fixed';
    input.style.left = '-9999px';

    let settled = false;
    let picking = false; // a selection is being processed — don't resolve empty
    const done = (files: PickedFile[]) => {
      if (settled) return;
      settled = true;
      try {
        document.body.removeChild(input);
      } catch {
        /* already gone */
      }
      resolve(files);
    };

    input.onchange = async () => {
      picking = true;
      const list = Array.from(input.files || []);
      const processed = await Promise.all(list.map((f) => downscaleImage(f)));
      done(
        processed.map((f) => ({
          uri: URL.createObjectURL(f),
          name: f.name,
          type: f.type || 'application/octet-stream',
          size: f.size,
          part: f,
        }))
      );
    };
    // If the dialog is cancelled there's no reliable event; resolve empty when the
    // window regains focus — but only if no selection is being processed (image
    // compression can take longer than this grace window).
    const onFocus = () => {
      window.removeEventListener('focus', onFocus);
      setTimeout(() => {
        if (!picking) done([]);
      }, 500);
    };
    window.addEventListener('focus', onFocus);

    document.body.appendChild(input);
    input.click();
  });
}
