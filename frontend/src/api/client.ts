import { API_BASE_URL } from './config';

// The auth store registers a getter here so every request can attach the token
// without the api layer depending on the store (avoids a circular import).
let tokenGetter: () => string | null = () => null;

export function setAuthTokenGetter(getter: () => string | null) {
  tokenGetter = getter;
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  /** Pass a FormData instance for multipart uploads (e.g. audio). */
  formData?: FormData;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, formData } = options;

  const headers: Record<string, string> = {};
  const token = tokenGetter();
  if (token) headers.Authorization = `Bearer ${token}`;

  let payload: string | FormData | undefined;
  if (formData) {
    // Let fetch set the multipart boundary automatically.
    payload = formData;
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, { method, headers, body: payload });
  } catch {
    throw new ApiError('Network error. Is the backend running?', 0);
  }

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const message = (data && data.error) || `Request failed (${response.status})`;
    throw new ApiError(message, response.status);
  }

  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PUT', body }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
  upload: <T>(path: string, formData: FormData) => request<T>(path, { method: 'POST', formData }),
};
