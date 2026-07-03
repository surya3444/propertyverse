// Native file picking: photos via react-native-image-picker, documents via
// @react-native-documents/picker. Both need the app to be rebuilt after install
// (native modules). `part` is an RN file descriptor `{ uri, name, type }` — what
// FormData needs to upload the file.
export interface PickedFile {
  uri: string;
  name: string;
  type: string;
  size?: number;
  part: unknown;
}

export const filePickerSupported = true;

// Lazy requires so a missing/not-yet-rebuilt native module degrades to a clear
// message instead of crashing the whole app at import time.
function imagePickerMod(): any | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('react-native-image-picker');
  } catch {
    return null;
  }
}
function documentsMod(): any | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('@react-native-documents/picker');
  } catch {
    return null;
  }
}

export async function pickFiles({
  accept = 'image/*',
  multiple = true,
}: { accept?: string; multiple?: boolean } = {}): Promise<PickedFile[]> {
  const isImage = /^image\//.test(accept);
  return isImage ? pickImages(multiple) : pickDocuments(multiple);
}

async function pickImages(multiple: boolean): Promise<PickedFile[]> {
  const mod = imagePickerMod();
  if (!mod?.launchImageLibrary) {
    throw new Error('Photo picker needs a fresh app build (npx react-native run-android).');
  }
  // Downscale on-device so uploads stay small — mirrors the web canvas compression.
  const res = await mod.launchImageLibrary({
    mediaType: 'photo',
    selectionLimit: multiple ? 0 : 1,
    maxWidth: 1600,
    maxHeight: 1600,
    quality: 0.82,
    includeBase64: false,
  });
  if (res?.didCancel) return [];
  if (res?.errorCode) throw new Error(res.errorMessage || 'Could not open the gallery.');
  const assets: any[] = res?.assets ?? [];
  return assets
    .filter((a) => a.uri)
    .map((a) => {
      const name = a.fileName || `photo-${Date.now()}.jpg`;
      const type = a.type || 'image/jpeg';
      return { uri: a.uri, name, type, size: a.fileSize, part: { uri: a.uri, name, type } };
    });
}

async function pickDocuments(multiple: boolean): Promise<PickedFile[]> {
  const mod = documentsMod();
  if (!mod?.pick) {
    throw new Error('Document picker needs a fresh app build (npx react-native run-android).');
  }
  const { pick, types } = mod;
  try {
    const results = await pick({
      allowMultiSelection: multiple,
      type: [types?.pdf, types?.docx, types?.doc, types?.xlsx, types?.xls, types?.images].filter(Boolean),
    });
    const arr: any[] = Array.isArray(results) ? results : [results];
    return arr
      .filter((d) => d.uri)
      .map((d) => {
        const name = d.name || 'document';
        const type = d.type || 'application/octet-stream';
        return { uri: d.uri, name, type, size: d.size ?? undefined, part: { uri: d.uri, name, type } };
      });
  } catch (err: any) {
    // Cancellation is not an error — just no files chosen.
    const cancelled =
      mod.isCancel?.(err) ||
      mod.isErrorWithCode?.(err, mod.errorCodes?.OPERATION_CANCELED) ||
      /cancel/i.test(err?.message || '');
    if (cancelled) return [];
    throw err;
  }
}
