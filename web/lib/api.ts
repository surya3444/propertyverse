// Base URL of the shared PropertyVerse backend. Configured at build time via
// NEXT_PUBLIC_API_BASE_URL; falls back to the hosted API.
export const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_BASE_URL || 'https://propertyverse-1.onrender.com'
).replace(/\/$/, '');

export interface PublicField {
  key: string;
  label: string;
  type: 'text' | 'tel' | 'email' | 'number' | 'select' | 'textarea';
  required?: boolean;
  options?: string[];
  placeholder?: string;
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
  values: Record<string, string>
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
