// Base URL of the shared PropertyVerse backend. Configured at build time via
// NEXT_PUBLIC_API_BASE_URL; falls back to the hosted API.
export const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_BASE_URL || 'https://propertyverse-1.onrender.com'
).replace(/\/$/, '');

export interface UploadedMedia {
  url: string;
  publicId?: string;
  resourceType?: string;
  format?: string;
  bytes?: number;
  width?: number;
  height?: number;
  name?: string;
  mimeType?: string;
}

export interface VisibleWhen {
  field: string;
  operator: 'equals' | 'notEquals' | 'in' | 'notIn';
  values: string[];
}

export interface PublicField {
  key: string;
  label: string;
  type: 'text' | 'tel' | 'email' | 'number' | 'select' | 'textarea' | 'file';
  required?: boolean;
  options?: string[];
  placeholder?: string;
  // For `file` fields.
  accept?: 'image' | 'document' | 'any';
  multiple?: boolean;
  // Optional conditional visibility.
  visibleWhen?: VisibleWhen;
}

export interface PublicForm {
  publicId: string;
  type: 'lead' | 'property';
  title: string;
  description?: string;
  accentColor?: string;
  agentName?: string;
  fields: PublicField[];
}

// An answer is either free text (most fields) or a list of uploaded files.
export type FormValue = string | UploadedMedia[];

export async function fetchForm(publicId: string): Promise<PublicForm> {
  const res = await fetch(`${API_BASE_URL}/api/public/forms/${publicId}`, {
    cache: 'no-store',
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error((data && data.error) || 'This form is not available.');
  return data.form as PublicForm;
}

export async function submitForm(
  publicId: string,
  values: Record<string, FormValue>
): Promise<string> {
  const res = await fetch(`${API_BASE_URL}/api/public/forms/${publicId}/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: values }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error((data && data.error) || 'Something went wrong. Please try again.');
  return (data && data.message) || 'Thank you!';
}

// Upload files for a `file` field straight to the (unauthenticated, rate-limited)
// public backend endpoint, which streams them to Cloudinary and returns media
// descriptors we then submit under the field's key.
export async function uploadFiles(
  publicId: string,
  files: File[],
  accept: 'image' | 'document' | 'any'
): Promise<UploadedMedia[]> {
  const type = accept === 'document' ? 'document' : 'image';
  const body = new FormData();
  files.forEach((f) => body.append('files', f, f.name));
  const res = await fetch(
    `${API_BASE_URL}/api/public/forms/${publicId}/upload?type=${type}`,
    { method: 'POST', body }
  );
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error((data && data.error) || 'Upload failed. Please try again.');
  return (data && data.media) || [];
}

// Evaluate a field's conditional-visibility rule against current answers. Mirrors
// the backend services/formService.js isFieldVisible (authoritative there).
export function isFieldVisible(
  field: PublicField,
  values: Record<string, FormValue>
): boolean {
  const rule = field.visibleWhen;
  if (!rule || !rule.field) return true;
  const raw = values[rule.field];
  const current = typeof raw === 'string' ? raw.trim() : '';
  const set = (rule.values || []).map((v) => String(v));
  switch (rule.operator) {
    case 'notEquals':
      return current !== (set[0] ?? '');
    case 'in':
      return set.includes(current);
    case 'notIn':
      return !set.includes(current);
    case 'equals':
    default:
      return current === (set[0] ?? '');
  }
}
